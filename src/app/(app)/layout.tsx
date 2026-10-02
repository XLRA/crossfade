import { ViewerProvider } from "~/components/providers/viewer-provider";
import { AppShell } from "~/components/shell/app-shell";
import { getViewer } from "~/server/viewer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <ViewerProvider viewer={viewer}>
      <AppShell viewer={viewer}>{children}</AppShell>
    </ViewerProvider>
  );
}
