import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppNav from "@/components/layout/AppNav";

export default async function HandymanLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "HANDYMAN") redirect("/customer/dashboard");

  return (
    <div className="app-layout flex min-h-screen">
      <AppNav role="HANDYMAN" userName={user.name} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
