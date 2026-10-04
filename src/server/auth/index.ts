import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

// NextAuth() fills in env defaults (secret, basePath) on authConfig in place, so the object
// exported below is the complete config the route handler passes to Auth.js core.
const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const auth = cache(uncachedAuth);

export { auth, authConfig, handlers, signIn, signOut };
