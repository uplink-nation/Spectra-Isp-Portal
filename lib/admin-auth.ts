import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/types/portal";

export type AdminAuthResult = {
  isAdmin: boolean;
  user: {
    id: string;
    email?: string;
  } | null;
  customer: Customer | null;
  reason?: string;
};

export async function verifyAdminAccess(): Promise<AdminAuthResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      isAdmin: false,
      user: null,
      customer: null,
      reason: "User is not authenticated",
    };
  }

  // 1. Check if user email is in ADMIN_EMAILS environment list
  const configuredAdminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
    : [];

  const userEmail = user.email?.toLowerCase() || "";

  // If email is explicitly in admin emails list
  if (userEmail && configuredAdminEmails.includes(userEmail)) {
    // Also fetch customer info if exists
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle<Customer>();

    return {
      isAdmin: true,
      user,
      customer: customer || null,
    };
  }

  // 2. Check customer profile in Supabase database for is_admin flag
  try {
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle<Customer & { is_admin?: boolean }>();

    if (customer && customer.is_admin === true) {
      return {
        isAdmin: true,
        user,
        customer,
      };
    }

    // 3. Check Supabase user metadata role
    if (
      user.app_metadata?.role === "admin" ||
      user.user_metadata?.role === "admin"
    ) {
      return {
        isAdmin: true,
        user,
        customer: customer || null,
      };
    }

    // If no explicit admin emails configured in development environment,
    // allow initial operator if ADMIN_ALLOW_ALL_LOGGED_IN=true is set
    if (process.env.ADMIN_ALLOW_ALL_LOGGED_IN === "true") {
      return {
        isAdmin: true,
        user,
        customer: customer || null,
      };
    }

    return {
      isAdmin: false,
      user,
      customer: customer || null,
      reason: "User does not have administrator privileges",
    };
  } catch (err) {
    console.warn("Error checking admin privileges in database:", err);
    return {
      isAdmin: false,
      user,
      customer: null,
      reason: "Database query error",
    };
  }
}
