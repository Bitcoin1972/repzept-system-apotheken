import type { SanitizedSwexPayload } from "@/lib/support";

type SwexCustomerPayload = {
  projectId: string;
  externalRef: string;
  customerName: string;
  customerEmail?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: Record<string, string | null> | null;
};

type SwexOrderPayload = {
  projectId: string;
  externalRef: string;
  customerRef?: string | null;
  customerEmail?: string | null;
  productName: string;
  amountEur: number;
  currency: "EUR";
  billingCycle: "monthly" | "yearly" | "one_time";
  paymentStatus: "paid";
  checkoutSessionId?: string | null;
  subscriptionId?: string | null;
};

type SwexTicketPayload = SanitizedSwexPayload & {
  customerRef?: string | null;
};

function getSwexConfig() {
  return {
    baseUrl: process.env.SWEX_TOWER_BASE_URL,
    apiKey: process.env.SWEX_TOWER_API_KEY,
    customerPath: process.env.SWEX_TOWER_CUSTOMERS_PATH ?? "/customers/upsert",
    orderPath: process.env.SWEX_TOWER_ORDERS_PATH ?? "/orders/upsert",
    ticketPath: process.env.SWEX_TOWER_TICKETS_PATH ?? "/tickets",
  };
}

async function swexFetch<T>(path: string, payload: Record<string, unknown>, fallbackFactory: () => T) {
  const config = getSwexConfig();

  if (!config.baseUrl || !config.apiKey) {
    return fallbackFactory();
  }

  const response = await fetch(new URL(path, config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`SWEX Tower Fehler ${response.status}: ${responseBody}`);
  }

  return (await response.json()) as T;
}

export async function upsertSwexCustomer(payload: SwexCustomerPayload) {
  return swexFetch(getSwexConfig().customerPath, payload, () => ({
    customerRef: `SWEX-CUST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    acceptedAt: new Date().toISOString(),
    externalRef: payload.externalRef,
    payload,
  }));
}

export async function createSwexOrder(payload: SwexOrderPayload) {
  return swexFetch(getSwexConfig().orderPath, payload, () => ({
    saleRef: `SWEX-SALE-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    acceptedAt: new Date().toISOString(),
    externalRef: payload.externalRef,
    payload,
  }));
}

export async function submitSupportTicketToSwex(payload: SwexTicketPayload) {
  return swexFetch(getSwexConfig().ticketPath, payload, () => ({
    ticketRef: `SWEX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    acceptedAt: new Date().toISOString(),
    externalRef: payload.externalRef,
    payload,
  }));
}
