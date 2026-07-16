import https from "node:https";
import { randomUUID } from "node:crypto";

export const maxDuration = 60;

let cachedToken = null;
let tokenExpiresAt = 0;

function postJson(urlString, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const data = Buffer.from(body, "utf8");

    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": data.length,
          "Accept-Encoding": "identity",
        },
        family: 4,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 500,
            contentType: res.headers["content-type"] || "application/json",
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs} ms`));
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const authKey = process.env.GIGACHAT_AUTH_KEY;
  const scope = process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS";

  if (!authKey) {
    throw new Error("GIGACHAT_AUTH_KEY is missing");
  }

  const oauthBody = new URLSearchParams({ scope }).toString();
  const oauth = await postJson(
    "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
    {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      RqUID: randomUUID(),
      Authorization: `Basic ${authKey}`,
    },
    oauthBody,
    15000
  );

  if (oauth.status < 200 || oauth.status >= 300) {
    throw new Error(`GigaChat OAuth ${oauth.status}: ${oauth.text.slice(0, 300)}`);
  }

  const data = JSON.parse(oauth.text || "{}");
  if (!data.access_token) {
    throw new Error("OAuth response has no access_token");
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + 28 * 60 * 1000;
  return cachedToken;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const expectedSecret = process.env.PROXY_SHARED_SECRET;
  const receivedSecret = request.headers["x-proxy-key"];

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return response.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const input =
      typeof request.body === "string"
        ? JSON.parse(request.body || "{}")
        : request.body || {};

    const token = await getAccessToken();
    const payload = JSON.stringify({
      ...input,
      model:
        input.model || process.env.GIGACHAT_MODEL || "GigaChat-2-Pro",
    });

    const giga = await postJson(
      "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
      {
        "Content-Type": "application/json",
        Accept: "application/json",
        RqUID: randomUUID(),
        Authorization: `Bearer ${token}`,
      },
      payload,
      50000
    );

    response.status(giga.status);
    response.setHeader("Content-Type", giga.contentType);
    return response.send(giga.text);
  } catch (error) {
    console.error("GIGACHAT_PROXY_ERROR", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      cause: error?.cause?.message,
      causeCode: error?.cause?.code,
      stack: error?.stack,
    });

    return response.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      code: error?.code || error?.cause?.code || null,
    });
  }
}
