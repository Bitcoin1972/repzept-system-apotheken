import { NextResponse } from "next/server";

import { getPracticeDashboardContext } from "@/lib/bootstrap";

export async function GET() {
  const context = await getPracticeDashboardContext();

  return NextResponse.json(context);
}
