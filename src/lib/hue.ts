/** A stable hue (0-359) for an id, for the muted color washes behind playlist and profile headers. */
export function hueOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return hash % 360;
}
