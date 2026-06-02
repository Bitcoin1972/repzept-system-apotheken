import { redirect } from "next/navigation";

import { getCurrentUser, getRoleHomePath, parseLoginRoleHint } from "@/lib/auth";
import { LoginScreen } from "@/app/auth/login/screen";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(getRoleHomePath(user.role));
  }

  const params = searchParams ? await searchParams : {};
  const error = readParam(params.error);
  const registered = readParam(params.registered);
  const role = parseLoginRoleHint(readParam(params.role));

  return (
    <LoginScreen
      initialRole={role ?? "practice_admin"}
      initialError={error ?? null}
      registered={registered === "1"}
    />
  );
}
