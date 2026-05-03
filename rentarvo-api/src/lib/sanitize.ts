/**
 * Strip HTML tags from a string. Prevents stored XSS in notes/freeform fields.
 */
export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

/**
 * Strip Unicode bidi control characters that can be used for spoofing attacks.
 * Removes: LRE, RLE, PDF, LRO, RLO (U+202A-U+202E) and
 *           LRI, RLI, FSI, PDI (U+2066-U+2069)
 */
export function stripBidi(s: string): string {
  return s.replace(/[\u202a-\u202e\u2066-\u2069]/g, '');
}

/**
 * Full sanitization for freeform text fields: strip HTML, bidi chars, null bytes, and trim.
 */
export function sanitizeText(s: string): string {
  return stripBidi(stripHtml(s)).replace(/\0/g, '');
}

/**
 * Escape LIKE wildcards (% and _) for safe use in Prisma `contains` queries.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}
