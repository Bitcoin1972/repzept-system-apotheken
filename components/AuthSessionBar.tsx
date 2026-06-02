import Link from "next/link";

import { getCurrentUser, getRoleHomePath, getRoleLabel } from "@/lib/auth";

export async function AuthSessionBar() {
  const user = await getCurrentUser();

  return (
    <header className="auth-shell">
      <div className="auth-bar">
        <Link href={user ? getRoleHomePath(user.role) : "/"} className="auth-brand">
          Repzept
        </Link>

        {user ? (
          <div className="auth-links">
            <span className="auth-meta">
              {user.displayName} · {getRoleLabel(user.role)}
            </span>
            <Link href={getRoleHomePath(user.role)} className="secondary-link">
              Start
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="ghost-button">
                Logout
              </button>
            </form>
          </div>
        ) : (
          <div className="auth-links">
            <Link href="/login" className="secondary-link">
              Login
            </Link>
            <Link href="/register" className="primary-button">
              Registrierung
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
