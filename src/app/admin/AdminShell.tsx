"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <nav className="topnav">
        <div className="brand">
          <div className="brand-mark">D</div>
          <span>
            Admin
            <span className="brand-muted">
              {" / "}
              {pathname === "/admin/roadmap"
                ? "Roadmap"
                : pathname === "/admin/site-roadmap"
                ? "Site Roadmap"
                : pathname === "/admin/tasks"
                ? "Tasks"
                : "Dashboard"}
            </span>
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost admin-signout"
          onClick={signOut}
        >
          Sign out
        </button>
      </nav>
      <div className="admin-nav">
        <Link href="/admin" className={`admin-nav-link${pathname === "/admin" ? " active" : ""}`}>Dashboard</Link>
        <Link href="/admin/tasks" className={`admin-nav-link${pathname === "/admin/tasks" ? " active" : ""}`}>Tasks</Link>
        <Link href="/admin/roadmap" className={`admin-nav-link${pathname === "/admin/roadmap" ? " active" : ""}`}>Business</Link>
        <Link href="/admin/site-roadmap" className={`admin-nav-link${pathname === "/admin/site-roadmap" ? " active" : ""}`}>Site</Link>
      </div>
      {children}
    </div>
  );
}
