"use client";

import { Popover as RadixPopover } from "radix-ui";
import { forwardRef } from "react";

import { cn } from "~/lib/cn";

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverClose = RadixPopover.Close;

export const PopoverContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RadixPopover.Content>
>(function PopoverContent({ className, sideOffset = 10, ...props }, ref) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-50 w-[300px] rounded-xl bg-ink-750 p-4 text-sm text-fg shadow-[var(--shadow-pop)] animate-pop-in outline-none",
          className,
        )}
        {...props}
      />
    </RadixPopover.Portal>
  );
});
