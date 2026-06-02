import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";

export async function GET(request: Request) {
  await destroySession();

  return NextResponse.redirect(new URL("/auth/login", request.url), 303);
}

export async function POST(request: Request) {
  await destroySession();

  const contentType = request.headers.get("content-type") ?? "";
  const expectsJson = contentType.includes("application/json");

  if (!expectsJson) {
    return NextResponse.redirect(new URL("/auth/login", request.url), 303);
  }

  return NextResponse.json({
    ok: true,
    redirectTo: "/auth/login",
  });
}
