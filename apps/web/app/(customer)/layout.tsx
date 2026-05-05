import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppNav from "@/components/layout/AppNav";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/handyman/dashboard");

  return (
    <div className="app-layout flex min-h-screen">
      <AppNav role="CUSTOMER" userName={user.name} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
