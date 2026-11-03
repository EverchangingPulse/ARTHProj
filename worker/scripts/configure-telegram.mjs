const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const workerUrl = process.argv[2];

if (!botToken || !webhookSecret || !workerUrl) {
  throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and the Worker URL are required.");
}

if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
  throw new Error("The webhook secret must contain only letters, numbers, underscores, and hyphens.");
}

const webhookUrl = new URL("/webhook", workerUrl);
if (webhookUrl.protocol !== "https:") throw new Error("The Worker must use HTTPS.");

async function callTelegram(method, data) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true) {
    throw new Error(`Telegram ${method} failed: ${result.description || response.status}`);
  }
  return result.result;
}

await callTelegram("setMyCommands", {
  commands: [
    { command: "start", description: "Start Roman Inscription AR" },
    { command: "ar", description: "Open the augmented reality camera" },
    { command: "reference", description: "View the original inscription" },
    { command: "preview", description: "View the highlighted inscription" },
    { command: "help", description: "How to use the AR tools" }
  ]
});

await callTelegram("setWebhook", {
  url: webhookUrl.toString(),
  secret_token: webhookSecret,
  allowed_updates: ["message"],
  drop_pending_updates: false
});

const info = await callTelegram("getWebhookInfo", {});
if (info.url !== webhookUrl.toString()) throw new Error("Telegram reported a different webhook URL.");
console.log(`Commands registered. Telegram webhook configured at ${info.url}`);
