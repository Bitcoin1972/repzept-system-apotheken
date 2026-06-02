import { randomBytes, scryptSync } from "node:crypto";

import { AuthRole, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const demoPassword = "Repzept2026!";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function main() {
  const practice = await prisma.practice.findFirst({
    include: {
      doctors: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!practice) {
    throw new Error("Keine Praxis gefunden. Bitte zuerst die Demo-Praxis anlegen.");
  }

  const doctor =
    practice.doctors[0] ??
    (await prisma.doctorUser.create({
      data: {
        practiceId: practice.id,
        name: "Dr. Demo",
        email: "praxis@example.local",
      },
    }));

  const pharmacy = await prisma.pharmacyAccount.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!pharmacy) {
    throw new Error("Keine Apotheke gefunden. Bitte zuerst die Demo-Apotheke anlegen.");
  }

  const users = [
    {
      email: "admin@musterpraxis-nord.de",
      displayName: "Praxis Admin",
      role: AuthRole.PRACTICE_ADMIN,
      practiceId: practice.id,
      doctorUserId: null,
      pharmacyAccountId: null,
      label: "Admin-Login",
      path: "/login?role=practice_admin",
    },
    {
      email: doctor.email || "praxis@example.local",
      displayName: doctor.name,
      role: AuthRole.DOCTOR_USER,
      practiceId: practice.id,
      doctorUserId: doctor.id,
      pharmacyAccountId: null,
      label: "User-/Arzt-Login",
      path: "/login?role=doctor_user",
    },
    {
      email: pharmacy.email || "apotheke@example.local",
      displayName: pharmacy.name,
      role: AuthRole.PHARMACY_USER,
      practiceId: null,
      doctorUserId: null,
      pharmacyAccountId: pharmacy.id,
      label: "Apotheke-Login",
      path: "/login?role=pharmacy_user",
    },
  ];

  for (const user of users) {
    await prisma.authUser.upsert({
      where: {
        email: user.email,
      },
      update: {
        passwordHash: hashPassword(demoPassword),
        displayName: user.displayName,
        role: user.role,
        practiceId: user.practiceId,
        doctorUserId: user.doctorUserId,
        pharmacyAccountId: user.pharmacyAccountId,
      },
      create: {
        email: user.email,
        passwordHash: hashPassword(demoPassword),
        displayName: user.displayName,
        role: user.role,
        practiceId: user.practiceId,
        doctorUserId: user.doctorUserId,
        pharmacyAccountId: user.pharmacyAccountId,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        password: demoPassword,
        users: users.map(({ label, email, path }) => ({ label, email, path })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
