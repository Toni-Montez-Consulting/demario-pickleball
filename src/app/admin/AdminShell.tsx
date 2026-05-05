"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FeedbackModal from "@/components/FeedbackModal";

export default function AdminShell({
  children,
  overdueCount = 0,
}: {
  children: React.ReactNode;
  overdueCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
                ? "Site Tracker"
                : pathname === "/admin/tasks"
                ? "Tasks"
                : "Dashboard"}
            </span>
          </span>
        </div>
        <div className="topnav-actions">
          <button
            type="button"
            className="btn btn-ghost admin-feedback-btn"
            onClick={() => setFeedbackOpen(true)}
          >
            Report an issue
          </button>
          <button
            type="button"
            className="btn btn-ghost admin-signout"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </nav>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <div className="admin-nav">
        <Link href="/admin" className={`admin-nav-link${pathname === "/admin" ? " active" : ""}`}>Dashboard</Link>
        <Link href="/admin/tasks" className={`admin-nav-link${pathname === "/admin/tasks" ? " active" : ""}`}>
          Tasks
          {overdueCount > 0 && pathname !== "/admin/tasks" && (
            <span className="nav-overdue-badge" aria-label={`${overdueCount} overdue`}>{overdueCount}</span>
          )}
        </Link>
        <Link href="/admin/roadmap" className={`admin-nav-link${pathname === "/admin/roadmap" ? " active" : ""}`}>Business</Link>
        <Link href="/admin/site-roadmap" className={`admin-nav-link${pathname === "/admin/site-roadmap" ? " active" : ""}`}>Site Tracker</Link>
      </div>
      <p className="admin-nav-desc">
        {pathname === "/admin/tasks"
          ? "Track to-dos — anyone can add, complete, or delete tasks."
          : pathname === "/admin/roadmap"
          ? "DeMario's operating checklist — legal, digital presence, and milestones."
          : pathname === "/admin/site-roadmap"
          ? "Website development progress — Toni's reference."
          : "Manage bookings, inquiries, and DeMario's availability."}
      </p>
      {children}
    </div>
  );
}
