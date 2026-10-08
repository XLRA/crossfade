"use client";

import { Tooltip as RadixTooltip } from "radix-ui";

export const TooltipProvider = RadixTooltip.Provider;

/** Small label shown on hover or keyboard focus. Wraps exactly one focusable child. */
export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={8}
          collisionPadding={8}
          className="z-50 rounded-md bg-ink-700 px-2.5 py-1.5 text-[13px] font-medium text-fg shadow-[var(--shadow-pop)] animate-fade-in select-none"
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
