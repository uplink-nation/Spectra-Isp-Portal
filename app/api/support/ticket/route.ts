import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbTicket } from "@/lib/supabase/admin";
import { sendTelegramTicketAlert } from "@/lib/telegram-alert";
import type { Customer, SupportTicket, TicketCategory, TicketPriority } from "@/types/portal";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, pppoe_username")
      .eq("auth_user_id", user.id)
      .maybeSingle<Customer>();

    if (!customer) {
      return NextResponse.json({ error: "Subscriber profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const { category, subject, description, priority, contact_phone } = body as {
      category: TicketCategory;
      subject: string;
      description: string;
      priority: TicketPriority;
      contact_phone?: string;
    };

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Subject and description are required" }, { status: 400 });
    }

    // Save ticket into database via admin service client
    const createdTicket: SupportTicket = await createDbTicket({
      customer_id: customer.id,
      category: category || "general",
      subject: subject.trim(),
      description: description.trim(),
      priority: priority || "normal",
      contact_phone: contact_phone || null,
      customer_name: customer.name,
      pppoe_username: customer.pppoe_username,
    });

    // Dispatch instant Telegram Alert to NOC group
    try {
      await sendTelegramTicketAlert({
        ticket: createdTicket,
        customer,
      });
    } catch (telegramErr) {
      console.warn("Telegram ticket alert error:", telegramErr);
    }

    return NextResponse.json({
      ok: true,
      ticket: createdTicket,
    });
  } catch (error: unknown) {
    console.error("Support ticket creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
