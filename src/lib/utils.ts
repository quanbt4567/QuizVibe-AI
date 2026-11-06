/**
 * Lightweight classnames utility for conditionally joining CSS classes.
 * Zero external dependencies.
 */
export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(' ').trim();
}

