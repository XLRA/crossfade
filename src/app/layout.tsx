import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Archivo } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Crossfade",
    template: "%s · Crossfade",
  },
  description:
    "Search, play and organize music from Spotify and YouTube in one place. Mixed playlists play straight through.",
  applicationName: "Crossfade",
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
