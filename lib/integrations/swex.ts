import type { SanitizedSwexPayload } from "@/lib/support";

type SwexStripeIngestPayload = {
  hubId: string;
  projectId: string;
  externalRef: string;
  customerName: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  company?: string | null;
  customerAddress?: string | null;
  productName: string;
  amountEur: number;
  currency: "EUR";
  billingCycle: "monthly" | "yearly" | "one_time";
  paymentStatus: "paid";
  checkoutSessionId?: string | null;
  paymentReference?: string | null;
};

type SwexTicketPayload = SanitizedSwexPayload & {
  customerRef?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
};

function getSwexConfig() {
  return {
    baseUrl: process.env.SWEX_TOWER_BASE_URL,
    hubId: process.env.SWEX_HUB_ID,
    defaultProjectId: process.env.SWEX_PROJECT_ID ?? process.env.SWEX_DEFAULT_PROJECT_ID,
    stripeIngestToken: process.env.SWEX_STRIPE_INGEST_TOKEN ?? process.env.SWEX_TOWER_API_KEY,
    supportIngestToken: process.env.SWEX_SUPPORT_INGEST_TOKEN ?? process.env.SWEX_TOWER_API_KEY,
    stripeIngestPath: process.env.SWEX_STRIPE_INGEST_PATH ?? "/api/ingest/stripe-order",
    supportPath: process.env.SWEX_SUPPORT_INGEST_PATH ?? process.env.SWEX_TOWER_TICKETS_PATH ?? "/api/ingest/ai-support-ticket",
  };
}

async function swexFetch<T>(
  path: string,
  token: string | undefined,
  payload: Record<string, unknown>,
  fallbackFactory: () => T,
) {
  const config = getSwexConfig();

  if (!config.baseUrl || !token) {
    return fallbackFactory();
  }

  const response = await fetch(new URL(path, config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`SWEX Tower Fehler ${response.status}: ${responseBody}`);
  }

  return (await response.json()) as T;
}

function splitCustomerName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return {
      customerFirstName: null,
      customerLastName: null,
    };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    customerFirstName: firstName ?? null,
    customerLastName: rest.length > 0 ? rest.join(" ") : null,
  };
}

export function serializeCustomerAddress(address?: Record<string, string | null> | null) {
  if (!address) {
    return null;
  }

  return [
    address.line1,
    address.line2,
    [address.postal_code, address.city].filter(Boolean).join(" ").trim() || null,
    address.state,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function ingestSwexStripeOrder(payload: Omit<SwexStripeIngestPayload, "hubId">) {
  const config = getSwexConfig();
  const nameParts = splitCustomerName(payload.customerName);

  return swexFetch(
    config.stripeIngestPath,
    config.stripeIngestToken,
    {
      hubId: config.hubId,
      projectId: payload.projectId || config.defaultProjectId,
      externalRef: payload.externalRef,
      customerName: payload.customerName,
      customerFirstName: nameParts.customerFirstName,
      customerLastName: nameParts.customerLastName,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
      company: payload.company,
      customerAddress: payload.customerAddress,
      productName: payload.productName,
      amountEur: payload.amountEur,
      currency: payload.currency,
      billingCycle: payload.billingCycle,
      paymentStatus: payload.paymentStatus,
      checkoutSessionId: payload.checkoutSessionId ?? null,
      paymentReference: payload.paymentReference ?? null,
    },
    () => ({
      customerRef: `SWEX-CUST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      saleRef: `SWEX-SALE-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      acceptedAt: new Date().toISOString(),
      externalRef: payload.externalRef,
      payload,
    }),
  );
}

export async function upsertSwexCustomer(payload: { projectId: string; externalRef: string; customerName: string }) {
  return {
    customerRef: `SWEX-CUST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    acceptedAt: new Date().toISOString(),
    externalRef: payload.externalRef,
    payload,
  };
}

export async function submitSupportTicketToSwex(payload: SwexTicketPayload) {
  const config = getSwexConfig();

  return swexFetch(
    config.supportPath,
    config.supportIngestToken,
    {
      hubId: config.hubId,
      projectId: payload.projectId || config.defaultProjectId,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      customerEmail: payload.customerEmail ?? null,
      customerName: payload.customerName ?? null,
      sourceModel: "gpt-5-codex",
      externalRef: payload.externalRef,
      language: payload.language,
      customerRef: payload.customerRef ?? null,
    },
    () => ({
      ticketRef: `SWEX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      acceptedAt: new Date().toISOString(),
      externalRef: payload.externalRef,
      payload,
    }),
  );
}
