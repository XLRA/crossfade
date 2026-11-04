import { accountRouter } from "~/server/api/routers/account";
import { healthRouter } from "~/server/api/routers/health";
import { historyRouter } from "~/server/api/routers/history";
import { homeRouter } from "~/server/api/routers/home";
import { libraryRouter } from "~/server/api/routers/library";
import { likesRouter } from "~/server/api/routers/likes";
import { playlistRouter } from "~/server/api/routers/playlist";
import { searchRouter } from "~/server/api/routers/search";
import { trackRouter } from "~/server/api/routers/track";
import { userRouter } from "~/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  account: accountRouter,
  library: libraryRouter,
  likes: likesRouter,
  history: historyRouter,
  home: homeRouter,
  search: searchRouter,
  playlist: playlistRouter,
  track: trackRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
