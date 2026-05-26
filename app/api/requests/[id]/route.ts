import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;

  const requestRecord = await prisma.request.findUnique({
    where: {
      id: params.id,
    },
    include: {
      practice: true,
      releasedByDoctor: true,
      responses: {
        orderBy: {
          createdAt: "desc",
        },
      },
      requestDistributions: {
        include: {
          pharmacy: true,
          connection: {
            include: {
              practice: true,
            },
          },
        },
        orderBy: {
          releasedAt: "desc",
        },
      },
      dispenseLogs: {
        include: {
          pharmacy: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      supportTickets: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!requestRecord) {
    return NextResponse.json({ error: "Rezept nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(requestRecord);
}
