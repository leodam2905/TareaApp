import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminNav from "@/components/layout/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  return (
    <div className="app-layout relative flex min-h-screen overflow-hidden">
      {/* Decorative background illustration (full-screen, behind content) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 z-0 bg-center bg-no-repeat bg-contain opacity-30"
        style={{ backgroundImage: "url('/admin-bg.svg')" }}
      />
      <AdminNav userName={user.name} />
      <main className="relative z-10 flex-1 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
