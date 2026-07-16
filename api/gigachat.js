export const maxDuration = 60;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const authKey = process.env.GIGACHAT_AUTH_KEY;
  const scope =
    process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS";

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
        RqUID: crypto.randomUUID(),
        Authorization: `Basic ${authKey}`,
      },
      body: new URLSearchParams({ scope }),
      signal: AbortSignal.timeout(15000),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `GigaChat OAuth ${response.status}: ${text.slice(0, 300)}`
    );
  }

  const data = JSON.parse(text);

  if (!data.access_token) {
    throw new Error("OAuth response has no access_token");
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + 28 * 60 * 1000;

  return cachedToken;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json(
        { ok: false, error: "Method not allowed" },
        { status: 405 }
      );
    }

    const expectedSecret = process.env.PROXY_SHARED_SECRET;
    const receivedSecret = request.headers.get("x-proxy-key");

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    try {
      const input = await request.json();
      const token = await getAccessToken();

      const gigaResponse = await fetch(
        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            RqUID: crypto.randomUUID(),
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

      return new Response(text, {
        status: gigaResponse.status,
        headers: {
          "Content-Type":
            gigaResponse.headers.get("content-type") ||
            "application/json",
        },
      });
    } catch (error) {
      console.error("GIGACHAT_PROXY_ERROR", error);

      return Response.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        { status: 502 }
      );
    }
  },
};
