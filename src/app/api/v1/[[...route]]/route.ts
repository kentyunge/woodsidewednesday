import { handle } from "hono/vercel";
import { api } from "@/server/api/app";

// Writing a weekly recap with Claude can take a minute.
export const maxDuration = 300;

const handler = handle(api);

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
