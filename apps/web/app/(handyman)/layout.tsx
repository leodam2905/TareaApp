import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppNav from "@/components/layout/AppNav";
import { homePathFor } from "@/lib/home-path";

export default async function HandymanLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "HANDYMAN") redirect(homePathFor(user.role));

  return (
    <div className="app-layout flex min-h-screen">
      <AppNav role="HANDYMAN" userName={user.name} />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
