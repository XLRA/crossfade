"use client";

import { Fragment } from "react";
import { create } from "zustand";

import { Dialog, DialogContent } from "~/components/ui/dialog";
import { SHORTCUTS } from "~/lib/player/shortcuts";

const useShortcutsHelp = create<{ open: boolean }>(() => ({ open: false }));

/** Opens the list of keyboard shortcuts (the ? key, or the account menu). */
export const openShortcutsHelp = () => useShortcutsHelp.setState({ open: true });

export function ShortcutsDialog() {
  const open = useShortcutsHelp((s) => s.open);
  return (
    <Dialog open={open} onOpenChange={(next) => useShortcutsHelp.setState({ open: next })}>
      {open && <ShortcutsList />}
    </Dialog>
  );
}

function ShortcutsList() {
  // Macs say Command where everyone else says Ctrl.
  const apple = /Mac|iPhone|iPad/.test(navigator.userAgent);

  return (
    <DialogContent
      title="Keyboard shortcuts"
      description="They work anywhere in Crossfade, except while you're typing."
    >
      <dl className="scroll-area -mx-1 max-h-[min(520px,65vh)] divide-y divide-white/[0.06] px-1">
        {SHORTCUTS.map(({ label, combos }) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-sm">{label}</dt>
            <dd className="text-fg-subtle flex shrink-0 items-center gap-1.5 text-xs">
              {combos.map((combo, i) => (
                <Fragment key={combo.join("+")}>
                  {i > 0 && <span>or</span>}
                  <span className="flex items-center gap-1">
                    {combo.map((key) => (
                      <kbd
                        key={key}
                        className="bg-ink-700 text-fg min-w-6 rounded-[5px] border border-white/10 px-1.5 py-0.5 text-center font-sans text-[11px] font-semibold shadow-[inset_0_-1px_0_rgb(0_0_0/0.4)]"
                      >
                        {key === "Ctrl" && apple ? "⌘" : key}
                      </kbd>
                    ))}
                  </span>
                </Fragment>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </DialogContent>
  );
}
