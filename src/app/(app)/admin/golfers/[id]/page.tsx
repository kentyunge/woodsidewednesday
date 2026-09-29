import { GolferAdminView } from "./golfer-view";

export const metadata = { title: "Golfer" };

export default async function GolferAdminPage({ params }: PageProps<"/admin/golfers/[id]">) {
  return <GolferAdminView id={Number((await params).id)} back="golfers" />;
}
