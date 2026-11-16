import https from "node:https";
import { randomBytes, timingSafeEqual } from "node:crypto";

export const maxDuration = 30;

const METHODS = new Set([
  "getMe", "getWebhookInfo", "setWebhook",
  "sendMessage", "deleteMessage", "editMessageText",
  "answerCallbackQuery", "answerPreCheckoutQuery",
  "sendInvoice", "refundStarPayment", "sendDocument",
  "sendWidget", "answerWidgetQuery", "editMessageWidgetData",
]);

function authorized(received) {
  const expected = process.env.PROXY_SHARED_SECRET;
  return !!expected && typeof received === "string" &&
    Buffer.byteLength(received) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function multipart(fields, file) {
  const boundary = `tw-${randomBytes(18).toString("hex")}`;
  const parts = [];
  for (const [key, value] of Object.entries(fields || {})) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key.replace(/[^\w-]/g, "")}"\r\n\r\n${typeof value === "string" ? value : JSON.stringify(value)}\r\n`));
  }
  const data = Buffer.from(String(file.data || ""), "base64");
  if (!data.length || data.length > 3 * 1024 * 1024) throw Object.assign(new Error("invalid file"), { status: 413 });
  const name = String(file.name || "document.pdf").replace(/[^\w.-]/g, "_").slice(0, 80);
  const type = String(file.type || "application/octet-stream").replace(/[^\w.+/-]/g, "");
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`));
  parts.push(data, Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

function telegram(token, method, input, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const payload = input.file ? multipart(input.body, input.file) : {
      body: Buffer.from(JSON.stringify(input.body || {})), contentType: "application/json",
    };
    const req = https.request({
      hostname: "api.telegram.org", port: 443, family: 4,
      path: `/bot${token}/${method}`, method: "POST",
      rejectUnauthorized: true, timeout: timeoutMs,
      headers: { "Content-Type": payload.contentType, "Content-Length": payload.body.length, "Accept-Encoding": "identity", Connection: "close" },
    }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode || 502, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("Telegram timeout"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    req.end(payload.body);
  });
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed" });
  if (!authorized(request.headers["x-proxy-key"])) return response.status(401).json({ ok: false, error: "Unauthorized" });
  try {
    const input = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const token = String(input.token || "");
    const method = String(input.method || "");
    if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token) || !METHODS.has(method)) return response.status(400).json({ ok: false, error: "Invalid Telegram request" });
    if (JSON.stringify(input.body || {}).length > 100000) return response.status(413).json({ ok: false, error: "Payload too large" });
    const upstream = await telegram(token, method, input);
    response.status(upstream.status).setHeader("Content-Type", "application/json");
    return response.send(upstream.text);
  } catch (error) {
    console.error("TELEGRAM_PROXY_ERROR", { code: error?.code || null, message: error?.message || "unknown" });
    return response.status(error?.status || 502).json({ ok: false, error: "Telegram unavailable", code: error?.code || null });
  }
}
