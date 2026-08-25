import "dotenv/config";

import dotenv from "dotenv";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";

dotenv.config({ path: ".env.local" });

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = getRequiredEnv("TELEGRAM_API_HASH");

if (!apiId) {
  throw new Error(
    "Missing TELEGRAM_API_ID in .env.local"
  );
}

const stringSession = new StringSession("");

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} in .env.local`);
  }

  return value;
}

async function main() {
  const client = new TelegramClient(
    stringSession,
    apiId,
    apiHash,
    {
      connectionRetries: 5,
    }
  );

  console.log("Connecting to Telegram...");

  await client.start({
    phoneNumber: async () =>
      await input.text("Telegram phone number: "),

    password: async () =>
      await input.text("Telegram 2FA password: "),

    phoneCode: async () =>
      await input.text("Telegram login code: "),

    onError: (err) => {
      console.error("Telegram error:", err);
    },
  });

  console.log("");
  console.log("=================================");
  console.log("Telegram login successful!");
  console.log("=================================");
  console.log("");

  console.log("TELEGRAM_SESSION=");
  console.log(client.session.save());

  await client.disconnect();
}

main().catch(console.error);
