"use client";

import { Check, ChevronRight } from "lucide-react";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { forwardRef } from "react";

import { cn } from "~/lib/cn";

/*
 * Styled Radix menus. Dropdowns (the "..." buttons) and right-click context menus share the same
 * surface and item styles so a track menu looks the same however it was opened.
 */

const surface =
  "z-50 min-w-[220px] max-w-[320px] overflow-hidden rounded-lg bg-ink-750 p-1 text-sm text-fg shadow-[var(--shadow-pop)] animate-pop-in";
const item =
  "relative flex h-10 cursor-default items-center gap-3 rounded-[5px] px-3 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-white/[0.08] [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-fg-muted";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuGroup = DropdownMenu.Group;
export const MenuSub = DropdownMenu.Sub;

export const MenuContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>
>(function MenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(surface, className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
});

export const MenuItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { destructive?: boolean }
>(function MenuItem({ className, destructive, ...props }, ref) {
  return (
    <DropdownMenu.Item
      ref={ref}
      className={cn(item, destructive && "text-danger [&>svg]:text-danger", className)}
      {...props}
    />
  );
});

export const MenuCheckboxItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.CheckboxItem>
>(function MenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenu.CheckboxItem ref={ref} className={cn(item, "pr-9", className)} {...props}>
      {children}
      <DropdownMenu.ItemIndicator className="absolute right-3">
        <Check className="size-4 text-accent" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.CheckboxItem>
  );
});

export function MenuSeparator({ className }: { className?: string }) {
  return <DropdownMenu.Separator className={cn("mx-1 my-1 h-px bg-white/[0.08]", className)} />;
}

export function MenuLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <DropdownMenu.Label className={cn("px-3 pt-2 pb-1 text-xs font-medium text-fg-subtle", className)}>
      {children}
    </DropdownMenu.Label>
  );
}

export const MenuSubTrigger = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.SubTrigger>
>(function MenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <DropdownMenu.SubTrigger
      ref={ref}
      className={cn(item, "data-[state=open]:bg-white/[0.08]", className)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-4 text-fg-muted" />
    </DropdownMenu.SubTrigger>
  );
});

export const MenuSubContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.SubContent>
>(function MenuSubContent({ className, ...props }, ref) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent
        ref={ref}
        sideOffset={4}
        collisionPadding={12}
        className={cn(surface, className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
});

// --- Context menu (right click) ---------------------------------------------------------------

export const ContextMenuRoot = ContextMenu.Root;
export const ContextMenuTrigger = ContextMenu.Trigger;
export const ContextMenuSub = ContextMenu.Sub;

export const ContextMenuContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenu.Content>
>(function ContextMenuContent({ className, ...props }, ref) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Content
        ref={ref}
        collisionPadding={12}
        className={cn(surface, className)}
        {...props}
      />
    </ContextMenu.Portal>
  );
});

export const ContextMenuItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenu.Item> & { destructive?: boolean }
>(function ContextMenuItem({ className, destructive, ...props }, ref) {
  return (
    <ContextMenu.Item
      ref={ref}
      className={cn(item, destructive && "text-danger [&>svg]:text-danger", className)}
      {...props}
    />
  );
});

export function ContextMenuSeparator() {
  return <ContextMenu.Separator className="mx-1 my-1 h-px bg-white/[0.08]" />;
}

export const ContextMenuSubTrigger = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenu.SubTrigger>
>(function ContextMenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <ContextMenu.SubTrigger
      ref={ref}
      className={cn(item, "data-[state=open]:bg-white/[0.08]", className)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-4 text-fg-muted" />
    </ContextMenu.SubTrigger>
  );
});

export const ContextMenuSubContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ContextMenu.SubContent>
>(function ContextMenuSubContent({ className, ...props }, ref) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.SubContent
        ref={ref}
        sideOffset={4}
        collisionPadding={12}
        className={cn(surface, className)}
        {...props}
      />
    </ContextMenu.Portal>
  );
});
