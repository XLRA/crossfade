/**
 * OAuth scopes, kept in one place because the import flows check them too.
 *
 * Spotify: profile + playlists for import, and streaming/playback control for the Web Playback
 * SDK (Premium accounts play full tracks in the browser).
 *
 * Google: sign in only asks for the basic profile, which Google doesn't require app verification
 * for. YouTube library access is requested later, only if the user asks to import playlists
 * (incremental authorization).
 */
export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
] as const;

export const GOOGLE_SIGNIN_SCOPES = ["openid", "email", "profile"] as const;

export const YOUTUBE_READONLY_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export function hasScope(granted: string | null | undefined, scope: string): boolean {
  if (!granted) return false;
  return granted.split(/[\s,]+/).includes(scope);
}
