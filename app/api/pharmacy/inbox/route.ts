import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pharmacyId = searchParams.get("pharmacyId");

  if (!pharmacyId) {
    return NextResponse.json({ error: "pharmacyId fehlt." }, { status: 400 });
  }

  const inbox = await prisma.requestDistribution.findMany({
    where: {
      pharmacyId,
    },
    include: {
      pharmacy: true,
      connection: {
        include: {
          practice: true,
        },
      },
      request: {
        include: {
          practice: true,
          releasedByDoctor: true,
          dispenseLogs: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
    orderBy: {
      releasedAt: "desc",
    },
  });

  return NextResponse.json(inbox);
}
