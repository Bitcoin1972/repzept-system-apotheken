import { AuthRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { getPracticeDashboardContext } from "@/lib/bootstrap";
import {
  fetchPracticeReturnRows,
  pushPracticeRowsToPms,
  sendPracticeReturnEmail,
  type PracticeReturnFilters,
} from "@/lib/practice-request-return";
import { getPracticeAccessState } from "@/lib/practice-access";

type ReturnMode = "auto" | "pms" | "email";

export async function POST(request: Request) {
  const user = await requireRole([AuthRole.PRACTICE_ADMIN, AuthRole.DOCTOR_USER]);
  const context = await getPracticeDashboardContext({
    practiceId: user.practiceId ?? undefined,
    activeDoctorId: user.doctorUserId,
  });
  const access = getPracticeAccessState(context.practice);

  if (access.status !== "active") {
    return NextResponse.json(
      {
        error: "Die kostenlose Nutzung ist abgelaufen.",
        checkoutUrl: access.checkoutUrl,
      },
      { status: 402 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const mode = (body.mode as ReturnMode | undefined) ?? "auto";
  const filters: PracticeReturnFilters = {
    q: body.q ?? "",
    doctorId: body.doctorId ?? "",
    requestStatus: body.requestStatus ?? "",
    releaseStatus: body.releaseStatus ?? "",
    distributionStatus: body.distributionStatus ?? "",
    sort: body.sort ?? "released_desc",
    doctorScopeId: user.role === AuthRole.DOCTOR_USER ? user.doctorUserId : null,
  };

  const rows = await fetchPracticeReturnRows(context.practice.id, filters);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Keine freigegebenen Rezepte fuer die Rueckgabe gefunden." }, { status: 400 });
  }

  const practice = {
    name: context.practice.name,
    pmsWritebackUrl: context.practice.pmsWritebackUrl ?? null,
    pmsApiKeySecret: context.practice.pmsApiKeySecret ?? null,
    pickupNotificationEmail: context.practice.pickupNotificationEmail ?? null,
    pmsReturnEmail: context.practice.pmsReturnEmail ?? null,
  };

  let pmsResult:
    | Awaited<ReturnType<typeof pushPracticeRowsToPms>>
    | null = null;
  let emailResult:
    | Awaited<ReturnType<typeof sendPracticeReturnEmail>>
    | null = null;

  if (mode === "pms" || mode === "auto") {
    pmsResult = await pushPracticeRowsToPms({
      practice,
      rows,
    });
  }

  if (mode === "email" || (mode === "auto" && (!pmsResult || pmsResult.status !== "sent"))) {
    emailResult = await sendPracticeReturnEmail({
      practice,
      rows,
    });
  }

  return NextResponse.json({
    ok: true,
    mode,
    rows: rows.length,
    pms: pmsResult,
    email: emailResult,
  });
}
