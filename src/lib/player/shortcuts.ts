"use client";

import { usePlayer } from "./store";

/**
 * Keyboard shortcuts. The keys follow YouTube's, since that's what most people already know:
 * Space or K to play/pause, J and L for ten seconds, arrows for five, Shift+N/P to skip. Each
 * entry lists the key combinations that do the same thing.
 */
export const SHORTCUTS: { label: string; combos: string[][] }[] = [
  { label: "Play or pause", combos: [["Space"], ["K"]] },
  { label: "Next track", combos: [["Shift", "N"]] },
  { label: "Previous track", combos: [["Shift", "P"]] },
  { label: "Back 10 seconds", combos: [["J"]] },
  { label: "Forward 10 seconds", combos: [["L"]] },
  { label: "Back or forward 5 seconds", combos: [["←"], ["→"]] },
  { label: "Mute or unmute", combos: [["M"]] },
  { label: "Shuffle", combos: [["S"]] },
  { label: "Repeat", combos: [["R"]] },
  { label: "Show or hide the queue", combos: [["Q"]] },
  { label: "Search", combos: [["/"], ["Ctrl", "K"]] },
  { label: "Show these shortcuts", combos: [["?"]] },
];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Listens for the shortcuts on the whole window. Returns the function that stops listening. */
export function startShortcuts(onHelp: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target)) return;
    const element = event.target instanceof HTMLElement ? event.target : null;
    // Dialogs and menus keep their keys to themselves.
    if (element?.closest("[role=dialog], [role=alertdialog], [role=menu]")) return;
    // Let Space and the arrows work the button, link or slider that has focus.
    const onControl = Boolean(element?.closest("button, a, [role=slider], [role=menuitem]"));

    const player = usePlayer.getState();
    const key = event.key;
    let handled = true;

    if (key === " " && !onControl) player.togglePlay();
    else if ((key === "k" || key === "K") && !event.shiftKey) player.togglePlay();
    else if (key === "N" && event.shiftKey) player.next();
    else if (key === "P" && event.shiftKey) player.previous();
    else if (key === "j") player.seek(Math.max(0, player.positionMs - 10_000));
    else if (key === "l") player.seek(player.positionMs + 10_000);
    else if (key === "ArrowLeft" && !onControl) player.seek(Math.max(0, player.positionMs - 5_000));
    else if (key === "ArrowRight" && !onControl) player.seek(player.positionMs + 5_000);
    else if (key === "m") player.toggleMute();
    else if (key === "s") player.toggleShuffle();
    else if (key === "r") player.cycleRepeat();
    else if (key === "q") player.togglePanel("queue");
    else if (key === "?") onHelp();
    else handled = false;

    if (handled) event.preventDefault();
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
