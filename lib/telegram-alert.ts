import type { SupportTicket, Customer } from "@/types/portal";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function sendTelegramTicketAlert({
  ticket,
  customer,
}: {
  ticket: SupportTicket;
  customer?: Customer | null;
}) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn("TELEGRAM_CHAT_ID is not configured in .env.local; skipping Telegram alert.");
    return { success: false, reason: "Missing TELEGRAM_CHAT_ID" };
  }

  const priorityEmoji =
    ticket.priority === "urgent" ? "🔴 URGENT" : ticket.priority === "normal" ? "🟡 NORMAL" : "🟢 LOW";

  const categoryLabel = ticket.category.toUpperCase();
  const customerName = customer?.name || ticket.customer_name || "Unknown Subscriber";
  const pppoeUser = customer?.pppoe_username || ticket.pppoe_username || "N/A";
  const phone = ticket.contact_phone || "Not provided";
  const nowStr = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const messageText = `🚨 *NEW SPECTRA SUPPORT TICKET #${ticket.ticket_code}*
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Subscriber:* ${customerName}
🌐 *PPPoE Account:* \`${pppoeUser}\`
🏷️ *Category:* ${categoryLabel}
⚡ *Priority:* ${priorityEmoji}
📞 *Callback Mobile:* \`${phone}\`
🕒 *Time (IST):* ${nowStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 *Subject:*
${ticket.subject}

📄 *Issue Description:*
${ticket.description}
━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 *Action:* Ticket is logged in NOC Admin Portal.`;

  let sent = false;

  // 1. Try Telegram Bot API if TELEGRAM_BOT_TOKEN is configured
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: "Markdown",
        }),
      });

      if (response.ok) {
        sent = true;
        console.log(`[Telegram Alert] Sent ticket #${ticket.ticket_code} alert via Bot API.`);
      } else {
        const errorData = await response.json();
        console.warn("[Telegram Alert] Bot API returned error:", errorData);
      }
    } catch (botErr) {
      console.warn("[Telegram Alert] Failed to dispatch via Bot API:", botErr);
    }
  }

  // 2. Log event into Supabase telegram_events table for audit tracking
  try {
    const supabase = await createServerClient();
    const uniqueUpdateId = Date.now() + Math.floor(Math.random() * 1000);
    await supabase.from("telegram_events").insert({
      telegram_update_id: uniqueUpdateId,
      chat_id: String(chatId),
      message_text: `[TICKET_ALERT_${ticket.ticket_code}] ${ticket.subject} - ${customerName} (${pppoeUser})`,
    });
  } catch (dbErr) {
    console.warn("[Telegram Alert] Could not log to telegram_events table:", dbErr);
  }

  return { success: sent, message: messageText };
}
