import { listGolfers } from "@/server/admin";
import { GolfersAdmin } from "./golfers-admin";

export const metadata = { title: "Manage golfers" };

export default async function GolfersAdminPage() {
  const golfers = await listGolfers();
  return (
    <GolfersAdmin
      golfers={golfers.map((g) => ({ id: g.id, name: g.name, email: g.email, phone: g.phone, active: g.active, linked: !!g.userId }))}
    />
  );
}
