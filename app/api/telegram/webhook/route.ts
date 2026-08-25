import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TelegramWebhookMessage = {
  message_id?: unknown;
  chat?: {
    id?: unknown;
    type?: unknown;
  };
  text?: unknown;
};

type TelegramWebhookUpdate = {
  update_id?: unknown;
  message?: TelegramWebhookMessage;
};

export async function POST(request: NextRequest) {
  try {
    const update = (await request.json()) as TelegramWebhookUpdate;
    const message = update.message;

    if (!message) {
      console.log("Telegram webhook received update without a message.");
      return NextResponse.json({ ok: true, passive: true });
    }

    const chatId = String(message.chat?.id ?? "");
    const messageId = String(message.message_id ?? "");
    const text = typeof message.text === "string" ? message.text : "";
    const isPppoeUsage = text.toUpperCase().includes("PPPOE SESSION ENDED");

    console.log("========== PASSIVE TELEGRAM WEBHOOK ==========");
    console.log("Chat ID:", chatId);
    console.log("Message ID:", messageId);
    console.log("PPPoE usage message:", isPppoeUsage);
    console.log("No usage_sessions row was inserted by this endpoint.");
    console.log("==============================================");

    return NextResponse.json({
      ok: true,
      passive: true,
      usage_importer: "telegram-sync/listener.ts",
    });
  } catch (error) {
    console.error("Passive Telegram webhook error:", error);

    return NextResponse.json(
      {
        ok: false,
        passive: true,
        error: "Webhook internal error",
      },
      { status: 500 }
    );
  }
}
