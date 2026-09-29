import { handle } from "hono/vercel";
import { api } from "@/server/api/app";

const handler = handle(api);

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
