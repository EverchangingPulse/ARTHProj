import test from "node:test";
import assert from "node:assert/strict";
import { createReply } from "../src/bot.js";
import { createHandler } from "../src/index.js";

const config = {
  botUsername: "RomanInscriptionAR_bot",
  arUrl: "https://example.github.io/ARTHProj/",
  groupLaunchUrl: "https://t.me/RomanInscriptionAR_bot?startapp"
};

const environment = {
  BOT_TOKEN: "test-token",
  WEBHOOK_SECRET: "test-secret",
  BOT_USERNAME: config.botUsername,
  AR_URL: config.arUrl,
  GROUP_LAUNCH_URL: config.groupLaunchUrl
};

function update(text, type = "supergroup") {
  return {
    update_id: 42,
    message: {
      message_id: 22,
      chat: { id: -100123456, type },
      text
    }
  };
}

function request(body, headers = {}) {
  return new Request("https://bot.example/webhook", {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": "test-secret", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

test("group command opens the configured Main Mini App", () => {
  const reply = createReply(update("/ar@RomanInscriptionAR_bot").message, config);
  assert.equal(reply.reply_markup.inline_keyboard[0][0].url, config.groupLaunchUrl);
  assert.equal(reply.reply_markup.inline_keyboard[0][0].web_app, undefined);
});

test("private chat uses a Web App button", () => {
  const reply = createReply(update("/ar", "private").message, config);
  assert.equal(reply.reply_markup.inline_keyboard[0][0].web_app.url, config.arUrl);
});

test("unaddressed and foreign bot commands are ignored", () => {
  assert.equal(createReply(update("ordinary chat").message, config), null);
  assert.equal(createReply(update("/ar@OtherBot").message, config), null);
});

test("supports bot command suffix, uppercase, and arguments", () => {
  const reply = createReply(update("/AR@RomanInscriptionAR_bot abc").message, config);
  assert.match(reply.text, /Point your camera/);
});

test("constructs page links correctly for GitHub Pages subpaths", () => {
  const reply = createReply(update("/reference").message, config);
  assert.equal(reply.reply_markup.inline_keyboard[0][0].url, "https://example.github.io/ARTHProj/reference.html");
});

test("unknown commands produce no replies", () => {
  assert.equal(createReply(update("/unsupported").message, config), null);
});

test("group button falls back to website when no Main Mini App configured", () => {
  const reply = createReply(update("/ar").message, { ...config, groupLaunchUrl: undefined });
  assert.equal(reply.reply_markup.inline_keyboard[0][0].url, config.arUrl);
});

test("webhook rejects calls without the secret", async () => {
  const handler = createHandler(() => { throw Error("Unexpected outgoing request"); });
  const response = await handler(request(update("/ar"), { "X-Telegram-Bot-Api-Secret-Token": "invalid" }), environment);
  assert.equal(response.status, 401);
});

test("webhook refuses to run without secrets", async () => {
  const handler = createHandler();
  const response = await handler(request(update("/ar")), { ...environment, BOT_TOKEN: "" });
  assert.equal(response.status, 503);
});

test("webhook rejects malformed JSON", async () => {
  const handler = createHandler();
  assert.equal((await handler(request("{"), environment)).status, 400);
});

test("webhook rejects excessively large request bodies", async () => {
  const handler = createHandler();
  assert.equal((await handler(request("x".repeat(65537)), environment)).status, 413);
});

test("webhook sends requested command response to Telegram", async () => {
  let payload;
  const handler = createHandler(async (url, options) => {
    assert.match(url, /\/sendMessage$/);
    payload = JSON.parse(options.body);
    return Response.json({ ok: true, result: { message_id: 99 } });
  });
  const response = await handler(request(update("/preview")), environment);
  assert.equal(response.status, 200);
  assert.equal(payload.chat_id, -100123456);
  assert.equal(payload.reply_markup.inline_keyboard[0][0].url, "https://example.github.io/ARTHProj/overlay-preview.html");
});

test("does not call Telegram for unrelated group messages", async () => {
  const handler = createHandler(() => { throw Error("Unexpected outgoing request"); });
  assert.equal((await handler(request(update("Hello")), environment)).status, 200);
});

test("retries on Telegram API errors", async () => {
  const handler = createHandler(async () => Response.json({ ok: false }, { status: 429 }));
  assert.equal((await handler(request(update("/ar")), environment)).status, 502);
});

test("health endpoint does not expose secrets", async () => {
  const handler = createHandler();
  const response = await handler(new Request("https://bot.example/health"), environment);
  assert.deepEqual(await response.json(), { status: "ok" });
});
