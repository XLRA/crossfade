import { PlayerBar } from "~/components/player/player-bar";
import { LibrarySidebar } from "~/components/shell/library-sidebar";
import { TopBar } from "~/components/shell/top-bar";

/**
 * Desktop layout: top bar, then library | page | (now playing), then the player bar. Panels are
 * separate rounded surfaces on the near-black app background with 8px gutters.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-ink-950 md:p-2 md:pt-0">
      <TopBar />
      <div className="flex min-h-0 flex-1 gap-2">
        <LibrarySidebar />
        <main
          id="main"
          className="scroll-area relative min-w-0 flex-1 bg-ink-900 md:rounded-[var(--radius-panel)]"
        >
          {children}
        </main>
      </div>
      <PlayerBar />
    </div>
  );
}
