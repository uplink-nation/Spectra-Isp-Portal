import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH!;
const session = process.env.TELEGRAM_SESSION!;

const client = new TelegramClient(
  new StringSession(session),
  apiId,
  apiHash,
  {
    connectionRetries: 5,
  }
);

async function main() {
  await client.connect();

  console.log("\n========== TELEGRAM GROUPS ==========\n");

  const dialogs = await client.getDialogs({});

  for (const dialog of dialogs) {
    if (dialog.isGroup || dialog.isChannel) {
      console.log(
        `ID: ${dialog.id?.toString()} | NAME: ${dialog.name}`
      );
    }
  }

  await client.disconnect();
}

main().catch(console.error);