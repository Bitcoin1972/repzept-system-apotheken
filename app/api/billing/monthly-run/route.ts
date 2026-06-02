import { AuthRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { prepareMonthlyInvoiceForPharmacy } from "@/lib/billing";

export async function GET(request: Request) {
  try {
    const user = await requireRole([AuthRole.PHARMACY_USER]);

    if (!user.pharmacyAccountId) {
      return NextResponse.json({ error: "Kein Apothekenkonto hinterlegt." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const result = await prepareMonthlyInvoiceForPharmacy(user.pharmacyAccountId, month);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Monatsabrechnung konnte nicht vorbereitet werden.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole([AuthRole.PHARMACY_USER]);

    if (!user.pharmacyAccountId) {
      return NextResponse.json({ error: "Kein Apothekenkonto hinterlegt." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await prepareMonthlyInvoiceForPharmacy(user.pharmacyAccountId, body.month ?? null);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Monatsabrechnung konnte nicht vorbereitet werden.",
      },
      { status: 400 },
    );
  }
}
