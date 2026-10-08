const pending = new Map<string, Promise<void>>();

/**
 * Adds a third-party script once. The platform SDKs announce themselves through a global
 * callback, so callers wait on that rather than on the script's load event.
 */
export function loadScript(src: string): Promise<void> {
  const existing = pending.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pending.delete(src);
      script.remove();
      reject(new Error(`Couldn't load ${new URL(src).host}. Is something blocking it?`));
    };
    document.head.appendChild(script);
  });
  pending.set(src, promise);
  return promise;
}
