import { AuthRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PracticeStartPage() {
  const user = await requireRole([AuthRole.PRACTICE_ADMIN, AuthRole.DOCTOR_USER]);

  redirect(user.role === AuthRole.PRACTICE_ADMIN ? "/practice/setup" : "/practice/new");
}
