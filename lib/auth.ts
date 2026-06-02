import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { AuthRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "repzept_session";
const SESSION_DAYS = 14;

export type RegistrationRole = "practice_admin" | "doctor_user" | "pharmacy_user";

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, stored] = passwordHash.split(":");

  if (!salt || !stored) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(stored, "hex");

  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseRegistrationRole(value: string | null | undefined): RegistrationRole {
  if (value === "doctor_user" || value === "pharmacy_user") {
    return value;
  }

  return "practice_admin";
}

export function toAuthRole(role: RegistrationRole) {
  if (role === "doctor_user") {
    return AuthRole.DOCTOR_USER;
  }

  if (role === "pharmacy_user") {
    return AuthRole.PHARMACY_USER;
  }

  return AuthRole.PRACTICE_ADMIN;
}

export async function createSession(userId: string) {
  const token = randomBytes(24).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return expiresAt;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: hashSessionToken(token),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function clearSession() {
  await destroySession();
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(token),
    },
    include: {
      user: {
        include: {
          practice: true,
          doctorUser: true,
          pharmacyAccount: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({
        where: {
          id: session.id,
        },
      });
    }
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  return session.user;
}

export function getDashboardPathForRole(role: AuthRole) {
  if (role === AuthRole.PRACTICE_ADMIN) {
    return "/practice/setup";
  }

  if (role === AuthRole.DOCTOR_USER) {
    return "/practice/new";
  }

  if (role === AuthRole.PHARMACY_USER) {
    return "/pharmacy";
  }

  return "/practice";
}

export function getRoleHomePath(role: AuthRole) {
  if (role === AuthRole.PRACTICE_ADMIN) {
    return "/practice/setup";
  }

  if (role === AuthRole.DOCTOR_USER) {
    return "/practice/new";
  }

  return "/pharmacy";
}

export function getRoleLabel(role: AuthRole) {
  if (role === AuthRole.DOCTOR_USER) {
    return "doctor_user";
  }

  if (role === AuthRole.PHARMACY_USER) {
    return "pharmacy_user";
  }

  return "practice_admin";
}

export function canAccessPractice(role: AuthRole) {
  return role === AuthRole.PRACTICE_ADMIN || role === AuthRole.DOCTOR_USER;
}

export async function requireRole(roles: AuthRole[]) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!roles.includes(user.role)) {
    redirect(getRoleHomePath(user.role));
  }

  return user;
}
