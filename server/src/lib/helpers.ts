export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function publicError(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected server error.';
}
