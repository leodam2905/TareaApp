import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppNav from "@/components/layout/AppNav";

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = user.role === "HANDYMAN" ? "HANDYMAN" : "CUSTOMER";

  return (
    <div className="flex min-h-screen bg-tarea-ink">
      <AppNav role={role} userName={user.name} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
