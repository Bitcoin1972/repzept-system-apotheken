import { NextResponse } from "next/server";
import { AuthRole } from "@prisma/client";

import {
  createSession,
  getDashboardPathForRole,
  parseLoginRoleHint,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const expectsJson = contentType.includes("application/json");
  const body = expectsJson ? await request.json() : Object.fromEntries(await request.formData());
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const roleHint = parseLoginRoleHint(String(body.role ?? body.roleHint ?? ""));

  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }

  const user = await prisma.authUser.findUnique({
    where: {
      email,
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    if (expectsJson) {
      return NextResponse.json({ error: "Anmeldung fehlgeschlagen." }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/login?error=Anmeldung%20fehlgeschlagen.", request.url), 303);
  }

  if (roleHint) {
    const roleMap: Record<typeof roleHint, AuthRole> = {
      practice_admin: AuthRole.PRACTICE_ADMIN,
      doctor_user: AuthRole.DOCTOR_USER,
      pharmacy_user: AuthRole.PHARMACY_USER,
    };

    if (user.role !== roleMap[roleHint]) {
      const error = encodeURIComponent("Bitte den passenden Login fuer diese Rolle verwenden.");
      if (expectsJson) {
        return NextResponse.json({ error: "Bitte den passenden Login fuer diese Rolle verwenden." }, { status: 403 });
      }

      return NextResponse.redirect(new URL(`/login?error=${error}&role=${roleHint}`, request.url), 303);
    }
  }

  await createSession(user.id);

  const redirectTo = getDashboardPathForRole(user.role);

  if (!expectsJson) {
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  }

  return NextResponse.json({ ok: true, redirectTo });
}
