import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import { LoginScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "PHARMACY_USER" ? "/pharmacy" : "/practice/new");
  }

  return <LoginScreen />;
}
