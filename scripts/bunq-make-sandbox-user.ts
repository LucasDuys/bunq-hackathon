import { randomUUID } from "node:crypto";

const SANDBOX_URL = "https://public-api.sandbox.bunq.com";

const main = async () => {
  const resp = await fetch(`${SANDBOX_URL}/v1/sandbox-user-person`, {
    method: "POST",
    headers: {
      "Cache-Control": "no-cache",
      "User-Agent": "carbo/0.1",
      "X-Bunq-Client-Request-Id": randomUUID(),
      "X-Bunq-Language": "en_US",
      "X-Bunq-Region": "nl_NL",
      "X-Bunq-Geolocation": "0 0 0 0 000",
    },
  });

  if (!resp.ok) {
    console.error(`bunq sandbox user create failed: ${resp.status}`);
    console.error(await resp.text());
    process.exit(1);
  }

  const json = (await resp.json()) as {
    Response: Array<{ ApiKey?: { api_key: string } }>;
  };

  const apiKey = json.Response.find((r) => r.ApiKey)?.ApiKey?.api_key;
  if (!apiKey) {
    console.error("no ApiKey in response:");
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  console.log("# Sandbox API key (paste into .env.local as BUNQ_API_KEY):");
  console.log(apiKey);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
