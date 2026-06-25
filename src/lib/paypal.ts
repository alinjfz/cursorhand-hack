import { requireEnv, optionalEnv } from "./env.js";

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

function getBaseUrl(): string {
  const mode = optionalEnv("PAYPAL_MODE") ?? "sandbox";
  return mode === "live" ? LIVE_BASE : SANDBOX_BASE;
}

async function getAccessToken(): Promise<string> {
  const clientId = requireEnv("PAYPAL_CLIENT_ID");
  const clientSecret = requireEnv("PAYPAL_CLIENT_SECRET");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal auth error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}

export interface PayPalOrderResult {
  orderId: string;
  checkoutUrl: string;
}

export async function createCheckoutOrder(
  businessName: string,
  amount = "99.00",
): Promise<PayPalOrderResult> {
  const token = await getAccessToken();
  const webhookBase = optionalEnv("WEBHOOK_BASE_URL");

  const response = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: `Website Setup — ${businessName}`,
          amount: {
            currency_code: "GBP",
            value: amount,
          },
        },
      ],
      application_context: {
        brand_name: "Hands Off Web Agency",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        ...(webhookBase
          ? {
              return_url: `${webhookBase}/api/paypal/success`,
              cancel_url: `${webhookBase}/api/paypal/cancel`,
            }
          : {}),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal order error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    id: string;
    links: Array<{ rel: string; href: string }>;
  };

  const approveLink = json.links.find((l) => l.rel === "approve");
  if (!approveLink) {
    throw new Error("PayPal order missing approve link");
  }

  return {
    orderId: json.id,
    checkoutUrl: approveLink.href,
  };
}

export async function captureOrder(orderId: string): Promise<boolean> {
  const token = await getAccessToken();

  const response = await fetch(
    `${getBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal capture error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as { status: string };
  return json.status === "COMPLETED";
}
