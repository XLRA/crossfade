"use client";

import { createContext, useContext } from "react";

import { type Viewer } from "~/lib/types";

const ViewerContext = createContext<Viewer | null>(null);

export function ViewerProvider({
  viewer,
  children,
}: {
  viewer: Viewer | null;
  children: React.ReactNode;
}) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

/** The signed-in user, or null for guests. */
export function useViewer(): Viewer | null {
  return useContext(ViewerContext);
}
