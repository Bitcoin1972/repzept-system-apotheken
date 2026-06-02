import { NextResponse } from "next/server";
import { AuthRole, ConnectionVerificationStatus } from "@prisma/client";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await requireRole([AuthRole.PHARMACY_USER]);
  const body = await request.json();
  const pharmacyId = user.pharmacyAccountId ?? body.pharmacyId;

  if (!body.practiceId || !pharmacyId || !body.verificationCode) {
    return NextResponse.json(
      { error: "practiceId, pharmacyId und verificationCode sind erforderlich." },
      { status: 400 },
    );
  }

  const [practice, pharmacy] = await Promise.all([
    prisma.practice.findUnique({
      where: {
        id: body.practiceId,
      },
    }),
    prisma.pharmacyAccount.findUnique({
      where: {
        id: pharmacyId,
      },
    }),
  ]);

  if (!practice || !pharmacy) {
    return NextResponse.json({ error: "Praxis oder Apotheke nicht gefunden." }, { status: 404 });
  }

  if (pharmacy.verificationCode.trim() !== String(body.verificationCode).trim()) {
    return NextResponse.json(
      {
        error: "Der Identifikationscode passt nicht zur Apotheke.",
      },
      { status: 422 },
    );
  }

  const connection = await prisma.practicePharmacyConnection.upsert({
    where: {
      practiceId_pharmacyId: {
        practiceId: practice.id,
        pharmacyId: pharmacy.id,
      },
    },
    update: {
      pharmacyVerificationCode: pharmacy.verificationCode,
      verificationStatus: ConnectionVerificationStatus.VERIFIED,
      verificationReason: "Kennung, Session-Konto und Apotheke wurden regelbasiert bestaetigt.",
      connectedAt: new Date(),
      verifiedByAiAt: new Date(),
    },
    create: {
      practiceId: practice.id,
      pharmacyId: pharmacy.id,
      pharmacyVerificationCode: pharmacy.verificationCode,
      verificationStatus: ConnectionVerificationStatus.VERIFIED,
      verificationReason: "Kennung, Session-Konto und Apotheke wurden regelbasiert bestaetigt.",
      connectedAt: new Date(),
      verifiedByAiAt: new Date(),
    },
    include: {
      practice: true,
      pharmacy: true,
    },
  });

  return NextResponse.json({
    connection,
    verificationMode: "automatic_rule_verification",
  });
}
