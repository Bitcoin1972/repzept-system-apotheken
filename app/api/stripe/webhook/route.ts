import { NextResponse } from "next/server";

import { getStripeClient } from "@/lib/integrations/stripe";
import { processStripeEventForSwex } from "@/lib/stripe-swex-sync";

export const dynamic = "force-dynamic";

const relevantStripeEvents = new Set([
  "checkout.session.completed",
  "invoice.paid",
  "customer.subscription.created",
  "customer.subscription.updated",
  "payment_intent.succeeded",
]);

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe Webhook ist nicht vollstaendig konfiguriert." },
      { status: 400 },
    );
  }

  const payload = await request.text();

  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (!relevantStripeEvents.has(event.type)) {
      return NextResponse.json({ received: true, ignored: true, eventType: event.type });
    }

    const result = await processStripeEventForSwex(event);

    return NextResponse.json({
      received: true,
      eventType: event.type,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Stripe Webhook konnte nicht verarbeitet werden.",
      },
      { status: 400 },
    );
  }
}
