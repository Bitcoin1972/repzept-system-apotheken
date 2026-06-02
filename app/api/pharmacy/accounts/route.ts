import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function buildVerificationCode(name: string) {
  return `APO-${name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "NEU"}-${Math.floor(
    1000 + Math.random() * 9000,
  )}`;
}

export async function GET() {
  const pharmacies = await prisma.pharmacyAccount.findMany({
    include: {
      practiceConnections: {
        include: {
          practice: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return NextResponse.json(pharmacies);
}

export async function POST(request: Request) {
  const body = await request.json();

  const pharmacy = await prisma.pharmacyAccount.create({
    data: {
      name: body.name ?? "Neue Apotheke",
      email: body.email ?? null,
      contactPhone: body.contactPhone ?? null,
      street: body.street ?? null,
      city: body.city ?? null,
      postalCode: body.postalCode ?? null,
      latitude: body.latitude !== undefined && body.latitude !== "" ? Number(body.latitude) : null,
      longitude:
        body.longitude !== undefined && body.longitude !== "" ? Number(body.longitude) : null,
      stripeCustomerRef: body.stripeCustomerRef ?? null,
      swexTenantRef: body.swexTenantRef ?? null,
      verificationCode: buildVerificationCode(body.name ?? "Neue Apotheke"),
    },
    include: {
      practiceConnections: {
        include: {
          practice: true,
        },
      },
    },
  });

  return NextResponse.json(pharmacy, { status: 201 });
}
