import { redirect } from "next/navigation";

import { getCurrentUser, getRoleHomePath, parseLoginRoleHint } from "@/lib/auth";

import { LoginScreen } from "./screen";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : {};
  const role = parseLoginRoleHint(readParam(params.role));
  const error = readParam(params.error) ?? null;
  const registered = readParam(params.registered) === "1";

  if (user) {
    redirect(getRoleHomePath(user.role));
  }

  return <LoginScreen initialRole={role ?? "practice_admin"} initialError={error} registered={registered} />;
}
