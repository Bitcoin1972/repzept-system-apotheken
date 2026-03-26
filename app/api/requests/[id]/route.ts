import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const requestRecord = await prisma.request.findUnique({
    where: { id },
    include: {
      responses: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!requestRecord) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(requestRecord);
}
