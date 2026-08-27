#!/usr/bin/env bash
set -euo pipefail

if [[ "${RUNNER_OS:-}" != "Linux" ]]; then
  echo "brain-manual supports Linux GitHub Actions runners only." >&2
  exit 1
fi

resolve_path() {
  if [[ "$1" == /* ]]; then
    realpath -m -- "$1"
  else
    realpath -m -- "$GITHUB_WORKSPACE/$1"
  fi
}

vault_path="$(resolve_path "$INPUT_VAULT")"
output_path="$(resolve_path "$INPUT_OUTPUT")"
output_parent="$(dirname -- "$output_path")"
output_name="$(basename -- "$output_path")"

if [[ ! -d "$vault_path" ]]; then
  echo "Vault directory does not exist: $vault_path" >&2
  exit 1
fi
if [[ "$output_name" == "." || "$output_name" == "/" ]]; then
  echo "Output must name a directory beneath a writable parent: $output_path" >&2
  exit 1
fi
if [[ "$INPUT_STRICT_LINKS" != "true" && "$INPUT_STRICT_LINKS" != "false" ]]; then
  echo "strict-links must be true or false, received: $INPUT_STRICT_LINKS" >&2
  exit 1
fi

mkdir -p -- "$output_parent"
work_path="$RUNNER_TEMP/brain-manual-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$RANDOM"
mkdir -p -- "$work_path/work" "$work_path/tmp"
trap 'rm -rf -- "$work_path"' EXIT

args=(
  build
  --vault /vault
  --output "/output/$output_name"
  --base "$INPUT_BASE_PATH"
)
if [[ -n "$INPUT_SITE" ]]; then
  args+=(--site "$INPUT_SITE")
fi
while IFS= read -r pattern || [[ -n "$pattern" ]]; do
  [[ -z "$pattern" ]] && continue
  args+=(--exclude "$pattern")
done <<< "$INPUT_EXCLUSIONS"
if [[ "$INPUT_STRICT_LINKS" == "true" ]]; then
  args+=(--strict-links)
fi

docker run --rm \
  --read-only \
  --network none \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$vault_path,dst=/vault,readonly" \
  --mount "type=bind,src=$output_parent,dst=/output" \
  --mount "type=bind,src=$work_path/work,dst=/work" \
  --mount "type=bind,src=$work_path/tmp,dst=/tmp" \
  "$BRAIN_MANUAL_IMAGE" "${args[@]}"

printf 'output-path=%s\n' "$output_path" >> "$GITHUB_OUTPUT"
