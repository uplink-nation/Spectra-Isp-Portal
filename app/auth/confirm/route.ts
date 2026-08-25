import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const error_description = searchParams.get("error_description");

  // If there's an error from Supabase in URL
  if (error_description) {
    redirect(`/auth/error?error=${encodeURIComponent(error_description)}`);
  }

  // Determine next destination
  let next = searchParams.get("next") ?? "/";
  if (type === "recovery" && (!searchParams.get("next") || searchParams.get("next") === "/")) {
    next = "/auth/update-password";
  }

  const supabase = await createClient();

  // 1. Handle PKCE code exchange (Standard OAuth & Modern Supabase Auth)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    } else {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  // 2. Handle OTP / Token Hash Verification (Email Confirmation & Password Recovery)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      redirect(next);
    } else {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  // If no auth tokens found in request
  redirect(`/auth/error?error=${encodeURIComponent("No authorization code or recovery token found in the request.")}`);
}
