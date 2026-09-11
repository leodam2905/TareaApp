import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppNav from "@/components/layout/AppNav";
import { homePathFor } from "@/lib/home-path";
import { mayEnter } from "@/lib/dual-role";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A handyman profile means this account genuinely has both sides, so it is
  // admitted here whatever its stored `role` says. Without this the middleware
  // would let a dual-role user through and the layout would bounce them right
  // back -- two gates, and both have to agree.
  const dual = !!user.handymanProfile;
  if (!mayEnter("customer", user.role, dual)) redirect(homePathFor(user.role));

  return (
    <div className="app-layout flex min-h-screen">
      <AppNav role="CUSTOMER" userName={user.name} dual={dual} />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
