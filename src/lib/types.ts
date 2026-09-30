/** Types shared between server and client code. Must not import anything server-only. */

export type Viewer = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
};
