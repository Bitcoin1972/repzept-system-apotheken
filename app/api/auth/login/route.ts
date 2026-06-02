import { NextResponse } from "next/server";

import {
  createSession,
  getDashboardPathForRole,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }

  const user = await prisma.authUser.findUnique({
    where: {
      email,
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Anmeldung fehlgeschlagen." }, { status: 401 });
  }

  await createSession(user.id);

  return NextResponse.json({
    ok: true,
    redirectTo: getDashboardPathForRole(user.role),
  });
}
