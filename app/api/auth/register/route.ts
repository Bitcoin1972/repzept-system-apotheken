import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import {
  createSession,
  getRoleHomePath,
  hashPassword,
  normalizeEmail,
  parseRegistrationRole,
  toAuthRole,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicUrl } from "@/lib/request-url";

function redirectToRegister(request: Request, role: string, message: string) {
  return NextResponse.redirect(buildPublicUrl(request, `/register?role=${role}&error=${encodeURIComponent(message)}`));
}

function buildVerificationCode() {
  return `APO-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const role = parseRegistrationRole(String(formData.get("role") ?? ""));
  const displayName = String(formData.get("displayName") ?? "").trim();
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const practiceId = String(formData.get("practiceId") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!displayName || !email || password.length < 8) {
    return redirectToRegister(request, role, "Name, E-Mail und ein Passwort ab 8 Zeichen sind erforderlich.");
  }

  const existingUser = await prisma.authUser.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    return redirectToRegister(request, role, "Diese E-Mail ist bereits registriert.");
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      if (role === "practice_admin") {
        if (!organizationName) {
          throw new Error("Praxisname fehlt.");
        }

        const now = new Date();
        const trialEndsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
        const practice = await tx.practice.create({
          data: {
            name: organizationName,
            pickupNotificationEmail: email,
            trialStartsAt: now,
            trialEndsAt,
          },
        });

        const doctor = await tx.doctorUser.create({
          data: {
            practiceId: practice.id,
            name: displayName,
            email,
          },
        });

        return tx.authUser.create({
          data: {
            email,
            passwordHash: hashPassword(password),
            role: toAuthRole(role),
            displayName,
            practiceId: practice.id,
            doctorUserId: doctor.id,
          },
        });
      }

      if (role === "doctor_user") {
        if (!practiceId) {
          throw new Error("Praxis fehlt.");
        }

        const practice = await tx.practice.findUnique({
          where: {
            id: practiceId,
          },
        });

        if (!practice) {
          throw new Error("Praxis nicht gefunden.");
        }

        const doctor = await tx.doctorUser.create({
          data: {
            practiceId,
            name: displayName,
            email,
          },
        });

        return tx.authUser.create({
          data: {
            email,
            passwordHash: hashPassword(password),
            role: toAuthRole(role),
            displayName,
            practiceId,
            doctorUserId: doctor.id,
          },
        });
      }

      if (!organizationName) {
        throw new Error("Apothekenname fehlt.");
      }

      const pharmacy = await tx.pharmacyAccount.create({
        data: {
          name: organizationName,
          email,
          billingEmail: email,
          verificationCode: buildVerificationCode(),
        },
      });

      return tx.authUser.create({
        data: {
          email,
          passwordHash: hashPassword(password),
          role: toAuthRole(role),
          displayName,
          pharmacyAccountId: pharmacy.id,
        },
      });
    });

    await createSession(user.id);

    return NextResponse.redirect(buildPublicUrl(request, getRoleHomePath(user.role)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registrierung fehlgeschlagen.";
    return redirectToRegister(request, role, message);
  }
}
