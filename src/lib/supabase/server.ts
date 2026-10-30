import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseBrowserKey } from "./keys";

/**
 * The server-only key, which bypasses RLS: the new secret key first, then the
 * legacy service_role key (see ./keys.ts for why both).
 */
export function supabaseServerKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Supabase server key missing: set SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  return key;
}

export function isAdminEmail(email: string | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !email) return false;
  const allowed = adminEmail.split(",").map((e) => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}

export async function createServerAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseBrowserKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseServerKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function requireAdmin() {
  const auth = await createServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: aal, error: aalError } = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal?.currentLevel !== "aal2") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "MFA required" }, { status: 401 }),
    };
  }

  return {
    ok: true as const,
    user,
    auth,
    supabase: createServiceRoleClient(),
  };
}

/**
 * The admin check for server-rendered admin pages: a signed-in admin with MFA
 * (aal2), or a redirect to login or MFA setup. Returns the service-role client
 * for the page's own reads.
 *
 * Every page under app/admin/(protected) calls this itself, before it reads
 * anything. The layout's check is not enough on its own: Next.js renders a
 * route's segments independently of the layout around them, so data access is
 * checked where it happens.
 * https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks
 */
export async function requireAdminPage() {
  const auth = await createServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/admin/login");

  const { data: aal, error: aalError } = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal?.currentLevel !== "aal2") {
    redirect(!aalError && aal?.nextLevel === "aal1" ? "/admin/mfa-setup" : "/admin/login");
  }

  return { user, supabase: createServiceRoleClient() };
}

export async function createServerSupabaseClient() {
  return createServerAuthClient();
}
