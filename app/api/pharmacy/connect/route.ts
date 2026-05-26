import { NextResponse } from "next/server";
import { ConnectionVerificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.practiceId || !body.pharmacyId || !body.verificationCode) {
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
        id: body.pharmacyId,
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
      connectedAt: new Date(),
      verifiedByAiAt: new Date(),
    },
    create: {
      practiceId: practice.id,
      pharmacyId: pharmacy.id,
      pharmacyVerificationCode: pharmacy.verificationCode,
      verificationStatus: ConnectionVerificationStatus.VERIFIED,
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
