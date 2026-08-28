#!/usr/bin/env bash
set -euo pipefail

if [[ "${RUNNER_OS:-}" != "Linux" ]]; then
  echo "Brain supports Linux GitHub Actions runners only." >&2
  exit 1
fi

resolve_path() {
  if [[ "$1" == /* ]]; then
    realpath -m -- "$1"
  else
    realpath -m -- "$GITHUB_WORKSPACE/$1"
  fi
}

workspace_root="$(realpath -e -- "$GITHUB_WORKSPACE")"
vault_input="${INPUT_VAULT:-}"
workspace_input="${INPUT_WORKSPACE:-}"
if [[ -n "$vault_input" && -n "$workspace_input" ]]; then
  echo "Options --vault and --workspace are mutually exclusive; choose one input mode." >&2
  exit 1
fi
if [[ -z "$vault_input" && -z "$workspace_input" ]]; then
  vault_input="vault"
fi

workspace_relative_path() {
  case "$1" in
    "$workspace_root") printf '.' ;;
    "$workspace_root"/*) printf '%s' "${1#"$workspace_root"/}" ;;
    *)
      echo "$2 must be inside the caller workspace: $1" >&2
      exit 1
      ;;
  esac
}

output_path="$(resolve_path "$INPUT_OUTPUT")"
output_parent="$(dirname -- "$output_path")"
output_name="$(basename -- "$output_path")"

if [[ "$output_name" == "." || "$output_name" == "/" ]]; then
  echo "Output must name a directory beneath a writable parent: $output_path" >&2
  exit 1
fi
if [[ "$INPUT_STRICT_LINKS" != "true" && "$INPUT_STRICT_LINKS" != "false" ]]; then
  echo "strict-links must be true or false, received: $INPUT_STRICT_LINKS" >&2
  exit 1
fi

mkdir -p -- "$output_parent"
work_path="$RUNNER_TEMP/brain-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$RANDOM"
mkdir -p -- "$work_path/work" "$work_path/tmp"
trap 'rm -rf -- "$work_path"' EXIT

args=(
  build
  --output "/output/$output_name"
  --base "$INPUT_BASE_PATH"
)
mounts=()
if [[ -n "$workspace_input" ]]; then
  workspace_path="$(resolve_path "$workspace_input")"
  if [[ ! -f "$workspace_path" ]]; then
    echo "Workspace manifest does not exist: $workspace_path" >&2
    exit 1
  fi
  workspace_relative_path "$workspace_path" "Workspace manifest" >/dev/null
  args+=(--workspace "$workspace_path")
  mounts+=(--mount "type=bind,src=$workspace_root,dst=$workspace_root,readonly")
else
  vault_path="$(resolve_path "$vault_input")"
  if [[ ! -d "$vault_path" ]]; then
    echo "Brain directory does not exist: $vault_path" >&2
    exit 1
  fi
  workspace_relative_path "$vault_path" "Brain directory" >/dev/null
  args+=(--vault /vault)
  mounts+=(--mount "type=bind,src=$vault_path,dst=/vault,readonly")
fi

if [[ -n "$workspace_input" ]]; then
  validation_input="$workspace_path"
  validation_mode="workspace"
else
  validation_input="$vault_path"
  validation_mode="vault"
fi
BRAIN_ACTION_MODE="$validation_mode" \
BRAIN_ACTION_INPUT="$validation_input" \
BRAIN_ACTION_OUTPUT="$output_path" \
BRAIN_ACTION_WORK="$work_path/work" \
BRAIN_ACTION_EXCLUSIONS="$INPUT_EXCLUSIONS" \
GITHUB_ACTION_PATH="$GITHUB_ACTION_PATH" \
node --input-type=module <<'NODE'
import { pathToFileURL } from "node:url";

const safetyUrl = pathToFileURL(`${process.env.GITHUB_ACTION_PATH}/scripts/generator-safety.mjs`);
const { validateGeneratorInputs } = await import(safetyUrl);
const mode = process.env.BRAIN_ACTION_MODE;
const exclusions = process.env.BRAIN_ACTION_EXCLUSIONS.split("\n").filter(Boolean);
await validateGeneratorInputs({
  mode,
  ...(mode === "workspace"
    ? { workspace: process.env.BRAIN_ACTION_INPUT }
    : { vault: process.env.BRAIN_ACTION_INPUT }),
  output: process.env.BRAIN_ACTION_OUTPUT,
  work: process.env.BRAIN_ACTION_WORK,
  exclusions,
});
NODE

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
  "${mounts[@]}" \
  --mount "type=bind,src=$output_parent,dst=/output" \
  --mount "type=bind,src=$work_path/work,dst=/work" \
  --mount "type=bind,src=$work_path/tmp,dst=/tmp" \
  "$BRAIN_IMAGE" "${args[@]}"

printf 'output-path=%s\n' "$output_path" >> "$GITHUB_OUTPUT"
