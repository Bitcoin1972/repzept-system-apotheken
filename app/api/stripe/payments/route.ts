import { NextResponse } from "next/server";

import { resolveStripePaymentFields } from "@/lib/integrations/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const payment = resolveStripePaymentFields(body);

    const record = await prisma.stripePaymentRecord.upsert({
      where: {
        stripePaymentIntentId: payment.stripePaymentIntentId,
      },
      update: payment,
      create: payment,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Stripe-Zahlung konnte nicht gespeichert werden.",
      },
      { status: 400 },
    );
  }
}
