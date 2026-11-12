/**
 * Demo data for trying Crossfade locally before any API keys are set up: three listeners and a
 * few playlists that mix Spotify tracks with YouTube videos, one of them shared. Sign in with the
 * developer login (AUTH_DEV_LOGIN="true" in .env) as demo, sam or maya.
 *
 *   npm run db:seed
 *
 * Safe to run again. Listeners are matched by username and playlists by fixed ids, and each run
 * puts the demo playlists back the way they're written here.
 *
 * YouTube durations are left at 0 on purpose: without an API key the app learns a video's length
 * the first time it plays, the same as for a link pasted into search.
 */
import { PrismaClient, type Source, type Visibility } from "../generated/prisma";

type SeedTrack = {
  source: Source;
  sourceId: string;
  title: string;
  artist: string;
  album: string | null;
  albumId: string | null;
  artworkUrl: string | null;
  durationMs: number;
  explicit: boolean;
  isrc: string | null;
};

const spotify = (
  sourceId: string,
  title: string,
  artist: string,
  album: [name: string, id: string, artwork: string],
  durationMs: number,
  isrc: string,
): SeedTrack => ({
  source: "SPOTIFY",
  sourceId,
  title,
  artist,
  album: album[0],
  albumId: album[1],
  artworkUrl: `https://i.scdn.co/image/${album[2]}`,
  durationMs,
  explicit: false,
  isrc,
});

const youtube = (sourceId: string, title: string, artist: string): SeedTrack => ({
  source: "YOUTUBE",
  sourceId,
  title,
  artist,
  album: null,
  albumId: null,
  artworkUrl: `https://i.ytimg.com/vi/${sourceId}/mqdefault.jpg`,
  durationMs: 0,
  explicit: false,
  isrc: null,
});

const DISCOVERY: [string, string, string] = [
  "Discovery",
  "2noRn2Aes5aoNVsU6iWThc",
  "ab67616d00001e021e81bff9807a9e629fce5ade",
];

const T = {
  nightcall: spotify(
    "0U0ldCRmgCqhVvD6ksG63j",
    "Nightcall",
    "Kavinsky",
    ["Nightcall", "07nBld9enf1PyRysZAVSqJ", "ab67616d00001e02d6d8c2eaa1f9031b62f7a3f7"],
    258_413,
    "FRS710900410",
  ),
  blindingLights: spotify(
    "0VjIjW4GlUZAMYd2vXMi3b",
    "Blinding Lights",
    "The Weeknd",
    ["After Hours", "4yP0hdKOZPNshxUOjY0cZj", "ab67616d00001e028863bc11d2aa12b54f5aeb36"],
    200_040,
    "USUG11904206",
  ),
  digitalLove: spotify("2VEZx7NWsZ1D0eJ4uv5Fym", "Digital Love", "Daft Punk", DISCOVERY, 301_373, "GBDUW0000058"),
  somethingAboutUs: spotify(
    "1NeLwFETswx8Fzxl2AFl91",
    "Something About Us",
    "Daft Punk",
    DISCOVERY,
    232_666,
    "GBDUW0000064",
  ),
  lovelyDay: spotify(
    "0bRXwKfigvpKZUurwqAlEh",
    "Lovely Day",
    "Bill Withers",
    ["Menagerie", "3QjPTUI6UcPr5m9RujkO3c", "ab67616d00001e0267c1113f55ab816ef61d3993"],
    257_157,
    "USSM10207844",
  ),
  dontKnowWhy: spotify(
    "1zNXF2svmdlNxfS5XeNUgr",
    "Don't Know Why",
    "Norah Jones",
    ["Come Away With Me (Super Deluxe Edition)", "3ArSFkv4OQOosOvYTrZNIl", "ab67616d00001e02c648a42b5dad72c8aafceeec"],
    186_251,
    "USBN20100529",
  ),
  dreams: spotify(
    "1lbXEepatjRVjoG8pZMtdp",
    "Dreams",
    "Fleetwood Mac",
    ["Greatest Hits", "0LfM3PGkXE6KvJEE1HkOnz", "ab67616d00001e02eb832efe061888ee7ef10456"],
    254_453,
    "USWB19900178",
  ),
  mrBrightside: spotify(
    "003vvx7Niy0yvhvHt4a68B",
    "Mr. Brightside",
    "The Killers",
    ["Hot Fuss", "4piJq7R3gjUOxnYs6lDCTg", "ab67616d00001e02ccdddd46119a4ff53eaf1f5d"],
    222_973,
    "USIR20400274",
  ),
  midnightCity: youtube("dX3k_QDnzHE", "Midnight City", "M83"),
  lessIKnow: youtube("2SUwOgmvzK4", "The Less I Know The Better", "Tame Impala"),
  oneMoreTime: youtube("FGBhQbmPwH8", "One More Time", "Daft Punk"),
  allOfMe: youtube("450p7goxZqg", "All of Me", "John Legend"),
  somebody: youtube("8UVNT4wvIGY", "Somebody That I Used To Know (feat. Kimbra)", "Gotye"),
  happy: youtube("ZbZSe6N_BXs", "Happy", "Pharrell Williams"),
  bohemianRhapsody: youtube("fJ9rUzIMcZQ", "Bohemian Rhapsody", "Queen"),
  heyYa: youtube("PWgvGjAhvIw", "Hey Ya!", "Outkast"),
  takeOnMe: youtube("djV11Xbc914", "Take On Me", "a-ha"),
};

const USERS = ["demo", "sam", "maya"] as const;
type Username = (typeof USERS)[number];

/** A track, or a track someone other than the owner added. */
type Entry = SeedTrack | { track: SeedTrack; by: Username };

type SeedPlaylist = {
  id: string;
  owner: Username;
  title: string;
  description: string;
  visibility: Visibility;
  collaborators: Username[];
  tracks: Entry[];
};

const PLAYLISTS: SeedPlaylist[] = [
  {
    id: "seednightdrive",
    owner: "demo",
    title: "Night Drive",
    description: "Synths, city lights and the long way home.",
    visibility: "PUBLIC",
    collaborators: [],
    tracks: [
      T.nightcall,
      T.midnightCity,
      T.blindingLights,
      T.lessIKnow,
      T.digitalLove,
      T.somethingAboutUs,
      T.oneMoreTime,
    ],
  },
  {
    id: "seedsundaymorning",
    owner: "maya",
    title: "Sunday Morning",
    description: "Slow coffee, open windows.",
    visibility: "PUBLIC",
    collaborators: [],
    tracks: [T.lovelyDay, T.dontKnowWhy, T.allOfMe, T.dreams, T.somebody, T.happy],
  },
  {
    id: "seedroadtrip",
    owner: "sam",
    title: "Road Trip",
    description: "Windows down. Everyone adds one.",
    visibility: "PRIVATE",
    collaborators: ["demo"],
    tracks: [T.bohemianRhapsody, { track: T.mrBrightside, by: "demo" }, T.heyYa, { track: T.takeOnMe, by: "demo" }],
  },
];

const LIKES: Partial<Record<Username, SeedTrack[]>> = {
  demo: [T.digitalLove, T.lovelyDay, T.takeOnMe],
  maya: [T.dreams],
};

const db = new PrismaClient();

async function main() {
  const users = new Map<Username, string>();
  for (const username of USERS) {
    // Same shape the developer login creates, so signing in as "demo" lands on this account.
    const user = await db.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        name: username.charAt(0).toUpperCase() + username.slice(1),
        email: `${username}@dev.crossfade.local`,
      },
    });
    users.set(username, user.id);
  }
  const userId = (username: Username) => users.get(username)!;

  const all = Object.values(T);
  await db.track.createMany({ data: all, skipDuplicates: true });
  const rows = await db.track.findMany({
    where: { OR: all.map(({ source, sourceId }) => ({ source, sourceId })) },
    select: { id: true, source: true, sourceId: true },
  });
  const trackId = (track: SeedTrack) =>
    rows.find((r) => r.source === track.source && r.sourceId === track.sourceId)!.id;

  for (const playlist of PLAYLISTS) {
    const data = {
      ownerId: userId(playlist.owner),
      title: playlist.title,
      description: playlist.description,
      visibility: playlist.visibility,
    };
    await db.$transaction([
      db.playlist.upsert({ where: { id: playlist.id }, create: { id: playlist.id, ...data }, update: data }),
      db.playlistTrack.deleteMany({ where: { playlistId: playlist.id } }),
      db.playlistCollaborator.deleteMany({ where: { playlistId: playlist.id } }),
      db.playlistTrack.createMany({
        data: playlist.tracks.map((entry, position) => {
          const { track, by } = "track" in entry ? entry : { track: entry, by: playlist.owner };
          return { playlistId: playlist.id, trackId: trackId(track), position, addedById: userId(by) };
        }),
      }),
      db.playlistCollaborator.createMany({
        data: playlist.collaborators.map((username) => ({ playlistId: playlist.id, userId: userId(username) })),
      }),
    ]);
  }

  for (const [username, tracks] of Object.entries(LIKES) as [Username, SeedTrack[]][]) {
    await db.trackLike.createMany({
      data: tracks.map((track) => ({ userId: userId(username), trackId: trackId(track) })),
      skipDuplicates: true,
    });
  }

  console.log(
    `Seeded ${USERS.length} listeners, ${PLAYLISTS.length} playlists and ${all.length} tracks. ` +
      `Sign in with the developer login as ${USERS.join(", ")}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
