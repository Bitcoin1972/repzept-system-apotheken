import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";
import { buildPublicUrl } from "@/lib/request-url";

export async function GET(request: Request) {
  await destroySession();

  return NextResponse.redirect(buildPublicUrl(request, "/auth/login"), 303);
}

export async function POST(request: Request) {
  await destroySession();

  const contentType = request.headers.get("content-type") ?? "";
  const expectsJson = contentType.includes("application/json");

  if (!expectsJson) {
    return NextResponse.redirect(buildPublicUrl(request, "/auth/login"), 303);
  }

  return NextResponse.json({
    ok: true,
    redirectTo: "/auth/login",
  });
}
