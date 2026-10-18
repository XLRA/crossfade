"use client";

import { X } from "lucide-react";
import { AlertDialog as RadixAlert, Dialog as RadixDialog } from "radix-ui";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";

const overlay = "fixed inset-0 z-50 bg-black/70 animate-fade-in";
const panel =
  "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-ink-800 p-6 text-fg shadow-[var(--shadow-pop)] animate-pop-in outline-none";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={overlay} />
      <RadixDialog.Content className={cn(panel, "max-w-[524px]", className)}>
        <div className="flex items-start justify-between gap-4">
          <RadixDialog.Title className="text-2xl font-bold">{title}</RadixDialog.Title>
          <RadixDialog.Close
            aria-label="Close"
            className="text-fg-muted hover:text-fg -mt-1 -mr-2 grid size-8 place-items-center rounded-full hover:bg-white/10"
          >
            <X className="size-5" />
          </RadixDialog.Close>
        </div>
        {description ? (
          <RadixDialog.Description className="text-fg-muted mt-1 text-sm">{description}</RadixDialog.Description>
        ) : (
          <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
        )}
        <div className="mt-5">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/** "Are you sure?" for destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <RadixAlert.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlert.Portal>
        <RadixAlert.Overlay className={overlay} />
        <RadixAlert.Content className={cn(panel, "max-w-[420px]")}>
          <RadixAlert.Title className="text-xl font-bold">{title}</RadixAlert.Title>
          <RadixAlert.Description className="text-fg-muted mt-2 text-sm">{description}</RadixAlert.Description>
          <div className="mt-6 flex justify-end gap-2">
            <RadixAlert.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </RadixAlert.Cancel>
            <Button variant="accent" onClick={onConfirm} disabled={pending}>
              {confirmLabel}
            </Button>
          </div>
        </RadixAlert.Content>
      </RadixAlert.Portal>
    </RadixAlert.Root>
  );
}
