export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function noteIdFromEntry(entry: string): string {
  const filename = entry.split(/[\\/]/).at(-1) ?? entry;
  return slugify(filename.replace(/\.md$/i, ""));
}
