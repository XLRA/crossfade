"use client";

import { Toaster as Sonner } from "sonner";

/** App-wide toasts, centered above the player bar like Spotify's. */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      offset={96}
      mobileOffset={{ bottom: 140 }}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-lg bg-fg px-4 py-3 text-[14px] font-medium text-ink-950 shadow-[var(--shadow-pop)]",
          title: "leading-snug",
          description: "text-[13px] font-normal text-ink-600",
          actionButton:
            "ml-auto shrink-0 rounded-full bg-ink-950 px-3 py-1.5 text-[13px] font-semibold text-fg hover:bg-ink-800",
          error: "!bg-danger !text-ink-950",
          icon: "shrink-0",
        },
      }}
    />
  );
}
