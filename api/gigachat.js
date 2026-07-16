import { randomUUID } from "node:crypto";

export const maxDuration = 60;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const authKey = process.env.GIGACHAT_AUTH_KEY;
  const scope = process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS";

  if (!authKey) {
    throw new Error("GIGACHAT_AUTH_KEY is missing");
  }

  const response = await fetch(
    "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        RqUID: randomUUID(),
        Authorization: `Basic ${authKey}`,
      },
      body: new URLSearchParams({ scope }),
      signal: AbortSignal.timeout(15000),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`GigaChat OAuth ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = JSON.parse(text);
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

    const gigaResponse = await fetch(
      "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          RqUID: randomUUID(),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...input,
          model:
            input.model ||
            process.env.GIGACHAT_MODEL ||
            "GigaChat-2-Pro",
        }),
        signal: AbortSignal.timeout(50000),
      }
    );

    const text = await gigaResponse.text();
    response.status(gigaResponse.status);
    response.setHeader(
      "Content-Type",
      gigaResponse.headers.get("content-type") || "application/json"
    );
    return response.send(text);
  } catch (error) {
    console.error("GIGACHAT_PROXY_ERROR", error);
    return response.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
