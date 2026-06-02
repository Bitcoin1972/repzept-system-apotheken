import { AuthRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { getPracticeDashboardContext } from "@/lib/bootstrap";
import {
  buildPracticeReturnCsv,
  buildPracticeReturnHtmlTable,
  fetchPracticeReturnRows,
  type PracticeReturnFilters,
} from "@/lib/practice-request-return";
import { getPracticeAccessState } from "@/lib/practice-access";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "html" ? "html" : "csv";
  const filters: PracticeReturnFilters = {
    q: searchParams.get("q")?.trim() ?? "",
    doctorId: searchParams.get("doctorId")?.trim() ?? "",
    requestStatus: searchParams.get("requestStatus")?.trim() ?? "",
    releaseStatus: searchParams.get("releaseStatus")?.trim() ?? "",
    distributionStatus: searchParams.get("distributionStatus")?.trim() ?? "",
    sort: searchParams.get("sort") ?? "released_desc",
    doctorScopeId: user.role === AuthRole.DOCTOR_USER ? user.doctorUserId : null,
  };

  const rows = await fetchPracticeReturnRows(context.practice.id, filters);
  const filenameDate = new Date().toISOString().slice(0, 10);

  if (format === "html") {
    return new NextResponse(buildPracticeReturnHtmlTable(rows), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="pms-rueckgabe-${filenameDate}.html"`,
      },
    });
  }

  return new NextResponse(buildPracticeReturnCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pms-rueckgabe-${filenameDate}.csv"`,
    },
  });
}
