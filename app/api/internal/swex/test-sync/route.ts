import { NextResponse } from "next/server";

import { AuthRole } from "@prisma/client";

import { requireRole } from "@/lib/auth";
import { runManualSwexSyncTest } from "@/lib/stripe-swex-sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireRole([AuthRole.PRACTICE_ADMIN]);

  const body = await request.json().catch(() => ({}));

  try {
    const result = await runManualSwexSyncTest({
      pharmacyId: body.pharmacyId ?? null,
      stripeCustomerId: body.stripeCustomerId ?? null,
      customerEmail: body.customerEmail ?? null,
      commit: body.commit === true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "SWEX-Test konnte nicht ausgefuehrt werden.",
      },
      { status: 400 },
    );
  }
}
