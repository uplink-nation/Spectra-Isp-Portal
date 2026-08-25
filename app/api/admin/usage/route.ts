import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin-auth";
import { getDbUsageSessions } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_id") || undefined;
    const limit = Number(searchParams.get("limit")) || 300;

    const usageSessions = await getDbUsageSessions(customerId, limit);
    return NextResponse.json({ ok: true, usageSessions });
  } catch (error: unknown) {
    console.error("Admin usage sessions query error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
