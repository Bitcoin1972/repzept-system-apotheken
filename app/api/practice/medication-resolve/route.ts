import { NextResponse } from "next/server";
import { AuthRole } from "@prisma/client";

import { requireRole } from "@/lib/auth";
import { resolveMedicationFromText } from "@/lib/medication-resolver";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await requireRole([AuthRole.PRACTICE_ADMIN, AuthRole.DOCTOR_USER]);
  const body = await request.json();
  const practiceId = user.practiceId;

  if (!practiceId) {
    return NextResponse.json({ error: "Kein Praxiskonto hinterlegt." }, { status: 400 });
  }

  const inputText = String(body.outputText ?? "").trim();
  if (!inputText) {
    return NextResponse.json({ parsed: null, suggestion: null });
  }

  const practice = await prisma.practice.findUnique({
    where: {
      id: practiceId,
    },
    select: {
      catalogSource: true,
      catalogApiBaseUrl: true,
      pmsApiBaseUrl: true,
      pmsApiKeySecret: true,
    },
  });

  if (!practice) {
    return NextResponse.json({ error: "Praxis nicht gefunden." }, { status: 404 });
  }

  const result = await resolveMedicationFromText(practice, inputText);
  return NextResponse.json(result);
}
