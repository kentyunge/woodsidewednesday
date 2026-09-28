import { Suspense } from "react";
import { AdminTabs } from "./admin-tabs";
import { requirePageAdmin } from "@/server/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requirePageAdmin();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">League admin</h1>
      </div>
      <Suspense>
        <AdminTabs />
      </Suspense>
      {children}
    </div>
  );
}
