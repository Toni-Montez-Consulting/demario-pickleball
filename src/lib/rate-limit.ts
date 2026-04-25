import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

interface RateLimitOptions {
  route: string;
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  req: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const ipHash = hashRequestIp(req);
  const windowStart = new Date(Date.now() - options.windowMs).toISOString();

  const { data, error } = await supabase
    .from("rate_limit_events")
    .select("created_at")
    .eq("route", options.route)
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart);

  if (error) {
    console.error("[rate-limit] count failed", error);
    return { limited: false };
  }

  if ((data?.length ?? 0) >= options.limit) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  const { error: insertError } = await supabase
    .from("rate_limit_events")
    .insert({ route: options.route, ip_hash: ipHash });

  if (insertError) {
    console.error("[rate-limit] insert failed", insertError);
  }

  return { limited: false };
}

export function hashRequestIp(req: NextRequest): string {
  const forwarded = req.headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    forwarded ||
    req.headers?.get("x-real-ip")?.trim() ||
    req.headers?.get("cf-connecting-ip")?.trim() ||
    "unknown";
  const salt =
    process.env.RATE_LIMIT_SALT ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "demario-pickleball";

  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
