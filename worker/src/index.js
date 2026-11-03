import { createReply } from "./bot.js";

const MAX_UPDATE_SIZE = 65536;

function safeEqual(actual, expected) {
  if (!actual || !expected) return false;
  const actualBytes = new TextEncoder().encode(actual);
  const expectedBytes = new TextEncoder().encode(expected);
  let difference = actualBytes.length ^ expectedBytes.length;
  for (let index = 0; index < Math.max(actualBytes.length, expectedBytes.length); index++) {
    difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

function configuration(env) {
  const botToken = env.BOT_TOKEN;
  const webhookSecret = env.WEBHOOK_SECRET;
  const botUsername = env.BOT_USERNAME?.replace(/^@/, "");
  let arUrl;
  let groupLaunchUrl;
  try {
    arUrl = new URL(env.AR_URL);
    groupLaunchUrl = env.GROUP_LAUNCH_URL ? new URL(env.GROUP_LAUNCH_URL) : null;
  } catch {
    return null;
  }
  if (!botToken || !webhookSecret || !botUsername || arUrl.protocol !== "https:" || (groupLaunchUrl && groupLaunchUrl.protocol !== "https:")) return null;
  return { botToken, webhookSecret, botUsername, arUrl: arUrl.toString(), groupLaunchUrl: groupLaunchUrl?.toString() };
}

async function sendMessage(fetchFn, token, payload) {
  const response = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) return false;
  const json = await response.json();
  return json.ok === true;
}

export function createHandler(fetchFn = fetch) {
  return async (request, env) => {
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET") {
      return Response.json({ status: "ok" });
    }
    if (path !== "/webhook") return new Response("Not found", { status: 404 });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const config = configuration(env);
    if (!config) return new Response("Service is not configured", { status: 503 });
    if (!safeEqual(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), config.webhookSecret)) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (Number(request.headers.get("content-length") || 0) > MAX_UPDATE_SIZE) {
      return new Response("Payload too large", { status: 413 });
    }

    let update;
    try {
      const body = await request.text();
      if (new TextEncoder().encode(body).length > MAX_UPDATE_SIZE) return new Response("Payload too large", { status: 413 });
      update = JSON.parse(body);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const reply = createReply(update?.message || {}, config);
    if (!reply) return new Response("OK");

    try {
      const sent = await sendMessage(fetchFn, config.botToken, reply);
      return new Response(sent ? "OK" : "Telegram API request failed", { status: sent ? 200 : 502 });
    } catch {
      return new Response("Telegram API unavailable", { status: 502 });
    }
  };
}

export default { fetch: createHandler() };
