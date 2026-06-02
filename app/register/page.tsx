import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, getRoleHomePath, parseRegistrationRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(getRoleHomePath(user.role));
  }

  const params = searchParams ? await searchParams : {};
  const role = parseRegistrationRole(readParam(params.role));
  const error = readParam(params.error);

  const practices =
    role === "doctor_user"
      ? await prisma.practice.findMany({
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [];

  return (
    <main className="workspace-shell auth-page">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Registrierung</p>
          <h1>Self-Serve-Onboarding fuer drei Rollen</h1>
          <p className="hero-copy">
            `practice_admin` erstellt eine neue Praxis, `doctor_user` haengt sich an eine
            bestehende Praxis, `pharmacy_user` legt ein neues Apothekenkonto an.
          </p>
        </div>
      </section>

      <nav className="auth-tabs">
        <Link
          href="/register?role=practice_admin"
          className={role === "practice_admin" ? "auth-tab auth-tab-active" : "auth-tab"}
        >
          practice_admin
        </Link>
        <Link
          href="/register?role=doctor_user"
          className={role === "doctor_user" ? "auth-tab auth-tab-active" : "auth-tab"}
        >
          doctor_user
        </Link>
        <Link
          href="/register?role=pharmacy_user"
          className={role === "pharmacy_user" ? "auth-tab auth-tab-active" : "auth-tab"}
        >
          pharmacy_user
        </Link>
      </nav>

      <section className="auth-card">
        {error ? <p className="release-banner warning">{error}</p> : null}

        <form action="/api/auth/register" method="post" className="auth-form">
          <input type="hidden" name="role" value={role} />

          <label className="field">
            <span>{role === "pharmacy_user" ? "Apotheke oder Teamname" : "Name"}</span>
            <input type="text" name="displayName" autoComplete="name" required />
          </label>

          {role === "practice_admin" ? (
            <label className="field">
              <span>Praxisname</span>
              <input type="text" name="organizationName" required />
            </label>
          ) : null}

          {role === "pharmacy_user" ? (
            <label className="field">
              <span>Apothekenname</span>
              <input type="text" name="organizationName" required />
            </label>
          ) : null}

          {role === "doctor_user" ? (
            <label className="field">
              <span>Praxis</span>
              <select name="practiceId" required defaultValue={practices[0]?.id ?? ""}>
                {practices.length === 0 ? (
                  <option value="">Keine Praxis vorhanden</option>
                ) : (
                  practices.map((practice) => (
                    <option key={practice.id} value={practice.id}>
                      {practice.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}

          <label className="field">
            <span>E-Mail</span>
            <input type="email" name="email" autoComplete="email" required />
          </label>

          <label className="field">
            <span>Passwort</span>
            <input type="password" name="password" autoComplete="new-password" minLength={8} required />
          </label>

          <div className="action-row">
            <button type="submit" className="primary-button">
              Zugang anlegen
            </button>
            <Link href="/login" className="secondary-link">
              Bereits registriert
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
