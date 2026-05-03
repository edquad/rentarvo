/**
 * Strips empty strings and null/undefined values from a payload
 * before sending to the backend. This prevents Zod validation failures on
 * optional UUID / enum fields that HTML forms submit as "".
 */
export function cleanPayload<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== '' && v != null)
  ) as Partial<T>;
}
