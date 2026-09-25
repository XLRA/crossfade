type ClassValue = string | number | null | false | undefined | ClassValue[];

/** Joins class names, skipping falsy values. Small enough that we don't need clsx. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }
  return out.join(" ");
}
