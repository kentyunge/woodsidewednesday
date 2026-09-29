import { GolferAdminView } from "../../golfers/[id]/golfer-view";

export const metadata = { title: "Sub" };

export default async function SubAdminPage({ params }: PageProps<"/admin/subs/[id]">) {
  return <GolferAdminView id={Number((await params).id)} back="subs" />;
}
