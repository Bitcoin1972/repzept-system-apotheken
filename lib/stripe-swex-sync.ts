import Stripe from "stripe";
import {
  InvoiceStatus,
  Prisma,
  SubscriptionStatus,
  SwexEntityType,
} from "@prisma/client";

import { resolveSwexProjectFromCatalog } from "@/lib/external-catalog";
import {
  createSwexOrder,
  upsertSwexCustomer,
} from "@/lib/integrations/swex";
import { getStripeClient, mapStripeInvoiceStatus } from "@/lib/integrations/stripe";
import { prisma } from "@/lib/prisma";
import { buildExternalRef } from "@/lib/support";

type EntityLink = {
  entityType: SwexEntityType;
  practiceId: string | null;
  pharmacyId: string | null;
  displayName: string;
  company: string | null;
  phone: string | null;
  email: string | null;
};

function normalizeAddress(address?: Stripe.Address | null) {
  if (!address) {
    return undefined;
  }

  return {
    line1: address.line1 ?? null,
    line2: address.line2 ?? null,
    city: address.city ?? null,
    postal_code: address.postal_code ?? null,
    state: address.state ?? null,
    country: address.country ?? null,
  };
}

function deriveBillingCycle(input: {
  mode?: string | null;
  interval?: string | null;
  subscriptionId?: string | null;
}) {
  if (input.interval === "year") {
    return "yearly" as const;
  }

  if (input.interval === "month" || input.subscriptionId || input.mode === "subscription") {
    return "monthly" as const;
  }

  return "one_time" as const;
}

function toAmountEur(amountCents: number) {
  return Number((amountCents / 100).toFixed(2));
}

function mapStripeSubscriptionStatus(status?: string | null) {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
    case "unpaid":
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.INACTIVE;
  }
}

async function resolveEntityFromStripe(input: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
}) {
  const metadataEntityType = input.metadata?.entityType;
  const metadataEntityId = input.metadata?.entityId;

  if (metadataEntityType === "pharmacy" && metadataEntityId) {
    const pharmacy = await prisma.pharmacyAccount.findUnique({
      where: { id: metadataEntityId },
    });
    if (pharmacy) {
      return {
        entityType: SwexEntityType.PHARMACY,
        practiceId: null,
        pharmacyId: pharmacy.id,
        displayName: pharmacy.name,
        company: pharmacy.name,
        phone: pharmacy.contactPhone ?? null,
        email: pharmacy.billingEmail ?? pharmacy.email ?? input.customerEmail ?? null,
      } satisfies EntityLink;
    }
  }

  if (metadataEntityType === "practice" && metadataEntityId) {
    const practice = await prisma.practice.findUnique({
      where: { id: metadataEntityId },
    });
    if (practice) {
      return {
        entityType: SwexEntityType.PRACTICE,
        practiceId: practice.id,
        pharmacyId: null,
        displayName: practice.name,
        company: practice.name,
        phone: null,
        email: practice.pickupNotificationEmail ?? input.customerEmail ?? null,
      } satisfies EntityLink;
    }
  }

  if (input.stripeSubscriptionId) {
    const pharmacyBySubscription = await prisma.pharmacyAccount.findFirst({
      where: { stripeSubscriptionRef: input.stripeSubscriptionId },
    });
    if (pharmacyBySubscription) {
      return {
        entityType: SwexEntityType.PHARMACY,
        practiceId: null,
        pharmacyId: pharmacyBySubscription.id,
        displayName: pharmacyBySubscription.name,
        company: pharmacyBySubscription.name,
        phone: pharmacyBySubscription.contactPhone ?? null,
        email: pharmacyBySubscription.billingEmail ?? pharmacyBySubscription.email ?? input.customerEmail ?? null,
      } satisfies EntityLink;
    }
  }

  if (input.stripeCustomerId) {
    const pharmacyByCustomer = await prisma.pharmacyAccount.findFirst({
      where: { stripeCustomerRef: input.stripeCustomerId },
    });
    if (pharmacyByCustomer) {
      return {
        entityType: SwexEntityType.PHARMACY,
        practiceId: null,
        pharmacyId: pharmacyByCustomer.id,
        displayName: pharmacyByCustomer.name,
        company: pharmacyByCustomer.name,
        phone: pharmacyByCustomer.contactPhone ?? null,
        email: pharmacyByCustomer.billingEmail ?? pharmacyByCustomer.email ?? input.customerEmail ?? null,
      } satisfies EntityLink;
    }

    const practiceByCustomer = await prisma.practice.findFirst({
      where: { stripeCustomerRef: input.stripeCustomerId },
    });
    if (practiceByCustomer) {
      return {
        entityType: SwexEntityType.PRACTICE,
        practiceId: practiceByCustomer.id,
        pharmacyId: null,
        displayName: practiceByCustomer.name,
        company: practiceByCustomer.name,
        phone: null,
        email: practiceByCustomer.pickupNotificationEmail ?? input.customerEmail ?? null,
      } satisfies EntityLink;
    }
  }

  if (input.customerEmail) {
    const pharmacyByEmail = await prisma.pharmacyAccount.findFirst({
      where: {
        OR: [
          { billingEmail: input.customerEmail },
          { email: input.customerEmail },
        ],
      },
    });
    if (pharmacyByEmail) {
      return {
        entityType: SwexEntityType.PHARMACY,
        practiceId: null,
        pharmacyId: pharmacyByEmail.id,
        displayName: pharmacyByEmail.name,
        company: pharmacyByEmail.name,
        phone: pharmacyByEmail.contactPhone ?? null,
        email: pharmacyByEmail.billingEmail ?? pharmacyByEmail.email,
      } satisfies EntityLink;
    }
  }

  return null;
}

async function persistEntityStripeRefs(input: {
  link: EntityLink;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  swexCustomerRef?: string | null;
  subscriptionStatus?: SubscriptionStatus | null;
}) {
  if (input.link.entityType === SwexEntityType.PHARMACY && input.link.pharmacyId) {
    await prisma.pharmacyAccount.update({
      where: { id: input.link.pharmacyId },
      data: {
        stripeCustomerRef: input.stripeCustomerId ?? undefined,
        stripeSubscriptionRef: input.stripeSubscriptionId ?? undefined,
        swexCustomerRef: input.swexCustomerRef ?? undefined,
        subscriptionStatus: input.subscriptionStatus ?? undefined,
      },
    });
  }

  if (input.link.entityType === SwexEntityType.PRACTICE && input.link.practiceId) {
    await prisma.practice.update({
      where: { id: input.link.practiceId },
      data: {
        stripeCustomerRef: input.stripeCustomerId ?? undefined,
        stripeSubscriptionRef: input.stripeSubscriptionId ?? undefined,
        swexCustomerRef: input.swexCustomerRef ?? undefined,
      },
    });
  }
}

async function upsertCustomerAndOrder(input: {
  stripeEventId: string;
  stripeCustomer: Stripe.Customer;
  stripeCustomerId: string;
  stripeCheckoutSessionId?: string | null;
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSubscriptionId?: string | null;
  amountCents: number;
  productName: string;
  billingCycle: "monthly" | "yearly" | "one_time";
  metadata?: Record<string, string>;
  externalRefOverride?: string | null;
}) {
  const link = await resolveEntityFromStripe({
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    customerEmail: input.stripeCustomer.email,
    metadata: input.metadata,
  });

  if (!link) {
    return {
      status: "ignored",
      reason: "Kein lokales Praxis-/Apothekenkonto fuer Stripe-Kunde gefunden.",
    };
  }

  const catalogEntry = await resolveSwexProjectFromCatalog({
    practiceId: link.practiceId,
    pharmacyId: link.pharmacyId,
    stripeCustomerId: input.stripeCustomerId,
  });

  const customerExternalRef = buildExternalRef("swex_customer", `${catalogEntry.projectId}:${input.stripeCustomerId}`);
  const existingCustomerLink = await prisma.swexCustomerLink.findUnique({
    where: {
      swexProjectId_stripeCustomerId: {
        swexProjectId: catalogEntry.projectId,
        stripeCustomerId: input.stripeCustomerId,
      },
    },
  });

  const customerResult = await upsertSwexCustomer({
    projectId: catalogEntry.projectId,
    externalRef: existingCustomerLink?.externalRef ?? customerExternalRef,
    customerName: input.stripeCustomer.name ?? link.displayName,
    customerEmail: input.stripeCustomer.email ?? link.email,
    phone: input.stripeCustomer.phone ?? link.phone,
    company: link.company,
    address: normalizeAddress(input.stripeCustomer.address),
  });

  const swexCustomerRef = String(
    (customerResult as { customerRef?: string }).customerRef ?? existingCustomerLink?.swexCustomerRef ?? "",
  );

  const customerLink = await prisma.swexCustomerLink.upsert({
    where: {
      swexProjectId_stripeCustomerId: {
        swexProjectId: catalogEntry.projectId,
        stripeCustomerId: input.stripeCustomerId,
      },
    },
    update: {
      swexCustomerRef,
      customerName: input.stripeCustomer.name ?? link.displayName,
      customerEmail: input.stripeCustomer.email ?? link.email,
      phone: input.stripeCustomer.phone ?? link.phone,
      company: link.company,
      address: normalizeAddress(input.stripeCustomer.address),
      lastPayload: customerResult as Prisma.JsonObject,
    },
    create: {
      entityType: link.entityType,
      practiceId: link.practiceId,
      pharmacyId: link.pharmacyId,
      stripeCustomerId: input.stripeCustomerId,
      swexProjectId: catalogEntry.projectId,
      swexCustomerRef,
      externalRef: existingCustomerLink?.externalRef ?? customerExternalRef,
      customerName: input.stripeCustomer.name ?? link.displayName,
      customerEmail: input.stripeCustomer.email ?? link.email,
      phone: input.stripeCustomer.phone ?? link.phone,
      company: link.company,
      address: normalizeAddress(input.stripeCustomer.address),
      lastPayload: customerResult as Prisma.JsonObject,
    },
  });

  await persistEntityStripeRefs({
    link,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    swexCustomerRef,
    subscriptionStatus: input.stripeSubscriptionId ? SubscriptionStatus.ACTIVE : null,
  });

  const orderExternalRef =
    input.externalRefOverride ??
    input.stripeCheckoutSessionId ??
    input.stripeInvoiceId ??
    input.stripePaymentIntentId ??
    input.stripeSubscriptionId ??
    input.stripeEventId;

  const existingOrder = await prisma.swexOrderSync.findUnique({
    where: {
      externalRef: orderExternalRef,
    },
  });

  if (existingOrder) {
    return {
      status: "duplicate",
      customerLink,
      order: existingOrder,
    };
  }

  const orderResult = await createSwexOrder({
    projectId: catalogEntry.projectId,
    externalRef: orderExternalRef,
    customerRef: swexCustomerRef,
    customerEmail: input.stripeCustomer.email ?? link.email,
    productName: input.productName,
    amountEur: toAmountEur(input.amountCents),
    currency: "EUR",
    billingCycle: input.billingCycle,
    paymentStatus: "paid",
    checkoutSessionId: input.stripeCheckoutSessionId ?? null,
    subscriptionId: input.stripeSubscriptionId ?? null,
  });

  const order = await prisma.swexOrderSync.create({
    data: {
      customerLinkId: customerLink.id,
      entityType: link.entityType,
      practiceId: link.practiceId,
      pharmacyId: link.pharmacyId,
      swexProjectId: catalogEntry.projectId,
      swexCustomerRef,
      swexSaleRef: String((orderResult as { saleRef?: string }).saleRef ?? "swex-sale-missing"),
      externalRef: orderExternalRef,
      stripeEventId: input.stripeEventId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      productName: input.productName,
      amountCents: input.amountCents,
      currency: "EUR",
      billingCycle: input.billingCycle,
      paymentStatus: "paid",
      payload: orderResult as Prisma.JsonObject,
    },
  });

  return {
    status: "synced",
    customerLink,
    order,
  };
}

export async function runManualSwexSyncTest(input?: {
  pharmacyId?: string | null;
  stripeCustomerId?: string | null;
  customerEmail?: string | null;
  commit?: boolean;
}) {
  const pharmacy = await prisma.pharmacyAccount.findFirst({
    where: {
      OR: [
        input?.pharmacyId ? { id: input.pharmacyId } : undefined,
        input?.stripeCustomerId ? { stripeCustomerRef: input.stripeCustomerId } : undefined,
        input?.customerEmail
          ? {
              OR: [{ billingEmail: input.customerEmail }, { email: input.customerEmail }],
            }
          : undefined,
        {
          stripeCustomerRef: {
            not: null,
          },
        },
      ].filter(Boolean) as Prisma.PharmacyAccountWhereInput[],
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  if (!pharmacy?.stripeCustomerRef) {
    throw new Error("Kein lokales Apothekenkonto mit Stripe-Kundenreferenz fuer den SWEX-Test gefunden.");
  }

  const stripeCustomer = await getCustomer(pharmacy.stripeCustomerRef);
  const entityMetadata = {
    entityType: "pharmacy",
    entityId: pharmacy.id,
  };

  const entityLink = await resolveEntityFromStripe({
    stripeCustomerId: pharmacy.stripeCustomerRef,
    customerEmail: stripeCustomer.email,
    metadata: entityMetadata,
  });

  if (!entityLink) {
    throw new Error("Der Stripe-Kunde konnte keinem lokalen Apothekenkonto zugeordnet werden.");
  }

  const catalogEntry = await resolveSwexProjectFromCatalog({
    pharmacyId: pharmacy.id,
    stripeCustomerId: pharmacy.stripeCustomerRef,
  });

  const productName = `Repzept Monatsabo (${pharmacy.plan.toLowerCase()})`;
  const externalRef = buildExternalRef(
    "manual_swex_sync",
    `${pharmacy.id}:${pharmacy.stripeCustomerRef}:${input?.commit ? Date.now() : "preview"}`,
  );

  const preview = {
    mode: input?.commit ? "commit" : "preview",
    pharmacy: {
      id: pharmacy.id,
      name: pharmacy.name,
      billingEmail: pharmacy.billingEmail ?? pharmacy.email ?? null,
      stripeCustomerRef: pharmacy.stripeCustomerRef,
      swexTenantRef: pharmacy.swexTenantRef ?? null,
      plan: pharmacy.plan,
      monthlyPriceCents: pharmacy.monthlyPriceCents,
    },
    customerPayload: {
      projectId: catalogEntry.projectId,
      externalRef: buildExternalRef("swex_customer", `${catalogEntry.projectId}:${pharmacy.stripeCustomerRef}`),
      customerName: stripeCustomer.name ?? pharmacy.name,
      customerEmail: stripeCustomer.email ?? pharmacy.billingEmail ?? pharmacy.email ?? null,
      phone: stripeCustomer.phone ?? pharmacy.contactPhone ?? null,
      company: pharmacy.name,
      address: normalizeAddress(stripeCustomer.address),
    },
    orderPayload: {
      projectId: catalogEntry.projectId,
      externalRef,
      customerEmail: stripeCustomer.email ?? pharmacy.billingEmail ?? pharmacy.email ?? null,
      productName,
      amountEur: toAmountEur(pharmacy.monthlyPriceCents),
      currency: "EUR" as const,
      billingCycle: "monthly" as const,
      paymentStatus: "paid" as const,
      checkoutSessionId: null,
      subscriptionId: pharmacy.stripeSubscriptionRef ?? null,
    },
  };

  if (!input?.commit) {
    return preview;
  }

  const result = await upsertCustomerAndOrder({
    stripeEventId: `manual_swex_sync_${Date.now()}`,
    stripeCustomer,
    stripeCustomerId: pharmacy.stripeCustomerRef,
    stripeSubscriptionId: pharmacy.stripeSubscriptionRef ?? null,
    amountCents: pharmacy.monthlyPriceCents,
    productName,
    billingCycle: "monthly",
    metadata: entityMetadata,
    externalRefOverride: externalRef,
  });

  return {
    ...preview,
    syncResult: result,
  };
}

async function getCustomer(customerId: string) {
  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    throw new Error(`Stripe customer ${customerId} ist geloescht.`);
  }

  return customer;
}

function getPriceInterval(price?: Stripe.Price | null) {
  const recurring = price?.recurring;
  return recurring?.interval ?? null;
}

export async function processStripeEventForSwex(event: Stripe.Event) {
  if (await prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: event.id } })) {
    return { status: "duplicate" as const };
  }

  await prisma.stripeWebhookEvent.create({
    data: {
      stripeEventId: event.id,
      eventType: event.type,
      objectId: "id" in event.data.object ? String(event.data.object.id) : null,
      status: "processing",
      payload: JSON.parse(JSON.stringify(event)) as Prisma.JsonObject,
    },
  });

  try {
    const stripe = getStripeClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.customer || typeof session.customer !== "string") {
        throw new Error("Checkout Session enthaelt keinen Stripe-Customer.");
      }

      const customer = await getCustomer(session.customer);
      const lineItems = session.id
        ? await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 })
        : { data: [] };
      const productName = lineItems.data.map((item) => item.description).filter(Boolean).join(", ") || "Stripe Checkout";
      const amountCents = session.amount_total ?? 0;

      const result = await upsertCustomerAndOrder({
        stripeEventId: event.id,
        stripeCustomer: customer,
        stripeCustomerId: session.customer,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
        stripeSubscriptionId:
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
        amountCents,
        productName,
        billingCycle: deriveBillingCycle({
          mode: session.mode,
          subscriptionId:
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
        }),
        metadata: session.metadata ?? {},
      });

      await prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: {
          status: result.status,
        },
      });

      return result;
    }

    if (event.type === "invoice.paid") {
      const invoiceObject = event.data.object as Stripe.Invoice;

      if (!invoiceObject.id) {
        throw new Error("Invoice Event enthaelt keine Invoice-ID.");
      }

      const invoice = await stripe.invoices.retrieve(invoiceObject.id, {
        expand: ["customer", "lines.data.price"],
      });

      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) {
        throw new Error("Invoice enthaelt keinen Stripe-Customer.");
      }

      const invoiceCustomer = invoice.customer;
      const customer =
        typeof invoiceCustomer === "string"
          ? await getCustomer(invoiceCustomer)
          : !invoiceCustomer || invoiceCustomer.deleted
            ? await getCustomer(customerId)
            : invoiceCustomer;
      const firstLine = invoice.lines.data[0];
      const productName = firstLine?.description || invoice.description || "Stripe Invoice";
      const invoiceLike = invoice as unknown as {
        payment_intent?: string | null;
        subscription?: string | null;
      };

      const result = await upsertCustomerAndOrder({
        stripeEventId: event.id,
        stripeCustomer: customer,
        stripeCustomerId: customerId,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId:
          typeof invoiceLike.payment_intent === "string" ? invoiceLike.payment_intent : null,
        stripeSubscriptionId:
          typeof invoiceLike.subscription === "string" ? invoiceLike.subscription : null,
        amountCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
        productName,
        billingCycle: deriveBillingCycle({
          subscriptionId:
            typeof invoiceLike.subscription === "string" ? invoiceLike.subscription : null,
        }),
        metadata: invoice.parent?.subscription_details?.metadata ?? invoice.metadata ?? {},
      });

      await prisma.pharmacyInvoice.updateMany({
        where: {
          stripeInvoiceId: invoice.id,
        },
        data: {
          status: mapStripeInvoiceStatus(invoice.status) as InvoiceStatus,
          stripeHostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
        },
      });

      await prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: {
          status: result.status,
        },
      });

      return result;
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.status !== "active") {
        await prisma.stripeWebhookEvent.update({
          where: { stripeEventId: event.id },
          data: {
            status: "ignored",
            errorMessage: `Subscription status ${subscription.status} wird nicht als paid synchronisiert.`,
          },
        });
        return { status: "ignored" as const };
      }

      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const customer = await getCustomer(customerId);
      const item = subscription.items.data[0];
      const productName = item?.price?.nickname ?? "Stripe Subscription";
      const interval = item?.price?.recurring?.interval ?? null;
      const amountCents = item?.price?.unit_amount ?? 0;

      const result = await upsertCustomerAndOrder({
        stripeEventId: event.id,
        stripeCustomer: customer,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        amountCents,
        productName,
        billingCycle: deriveBillingCycle({
          interval,
          subscriptionId: subscription.id,
        }),
        metadata: subscription.metadata ?? {},
      });

      const entity = await resolveEntityFromStripe({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        customerEmail: customer.email,
        metadata: subscription.metadata ?? {},
      });

      if (entity) {
        await persistEntityStripeRefs({
          link: entity,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: mapStripeSubscriptionStatus(subscription.status),
        });
      }

      await prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: {
          status: result.status,
        },
      });

      return result;
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      if (!paymentIntent.customer || typeof paymentIntent.customer !== "string") {
        await prisma.stripeWebhookEvent.update({
          where: { stripeEventId: event.id },
          data: {
            status: "ignored",
            errorMessage: "PaymentIntent ohne Customer wurde uebersprungen.",
          },
        });
        return { status: "ignored" as const };
      }

      const customer = await getCustomer(paymentIntent.customer);
      const result = await upsertCustomerAndOrder({
        stripeEventId: event.id,
        stripeCustomer: customer,
        stripeCustomerId: paymentIntent.customer,
        stripePaymentIntentId: paymentIntent.id,
        amountCents: paymentIntent.amount_received || paymentIntent.amount,
        productName: paymentIntent.description || "Stripe Payment",
        billingCycle: "one_time",
        metadata: paymentIntent.metadata ?? {},
      });

      await prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: {
          status: result.status,
        },
      });

      return result;
    }

    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: {
        status: "ignored",
        errorMessage: "Event-Typ wird fuer SWEX Sync nicht verarbeitet.",
      },
    });

    return { status: "ignored" as const };
  } catch (error) {
    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
    });
    throw error;
  }
}
