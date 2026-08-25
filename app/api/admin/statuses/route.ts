import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin-auth";
import { getDbCustomerStatusLogs, recordDbCustomerStatus } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_id") || undefined;
    const limit = Number(searchParams.get("limit")) || 100;

    const statusLogs = await getDbCustomerStatusLogs(customerId, limit);
    return NextResponse.json({ ok: true, statusLogs });
  } catch (error: unknown) {
    console.error("Admin status logs query error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.customer_id || !body.pppoe_username || !body.status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const record = await recordDbCustomerStatus({
      customer_id: body.customer_id,
      pppoe_username: body.pppoe_username,
      status: body.status,
      event_time: body.event_time,
      telegram_chat_id: body.telegram_chat_id,
      telegram_message_id: body.telegram_message_id,
    });

    return NextResponse.json({ ok: true, record });
  } catch (error: unknown) {
    console.error("Admin status record error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
