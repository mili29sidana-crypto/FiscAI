"use client";
 
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Card, Field, Status, formValues } from "@/components/form";
 
type Me = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    platformRole: string | null;
    emailVerifiedAt: string | null;
  };
  platformPermissions: string[];
  memberships: { firmId: string; firmName: string; role: string; firmStatus: string }[];
  onboarding: { state: string; nextStep: string } | null;
};
 
type SessionRow = {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
};
 
export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
 
  const load = useCallback(async () => {
    const profile = await api<Me>("/api/auth/me");
    if (!profile.ok) {
      setError(profile.error);
      setMe(null);
      return;
    }
    setMe(profile.data);
    const list = await api<{ sessions: SessionRow[] }>("/api/auth/sessions");
    if (list.ok) setSessions(list.data.sessions);
  }, []);
 
  useEffect(() => {
    void load();
  }, [load]);
 
  async function logout(all: boolean) {
    await api(all ? "/api/auth/logout-all" : "/api/auth/logout", { method: "POST", body: {} });
    router.push("/login");
    router.refresh();
  }
 
  async function revoke(id: string) {
    const result = await api(`/api/auth/sessions/${id}`, { method: "DELETE" });
    if (!result.ok) setError(result.error);
    await load();
  }
 
  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const result = await api<{ message: string }>("/api/auth/change-password", {
      body: formValues(event.currentTarget),
    });
    if (result.ok) setMessage(result.data.message);
    else setError(result.error);
    await load();
  }
 
  if (!me) {
    return (
      <Card title="Account">
        <Status error={error} />
        <p className="muted">
          <Link href="/login">Sign in</Link> to view your account.
        </p>
      </Card>
    );
  }
 
  return (
    <>
      <Card title="Account">
        <p>
          {me.user.firstName} {me.user.lastName} — {me.user.email}
        </p>
        <p className="muted">
          Status: {me.user.status} · Email verified: {me.user.emailVerifiedAt ? "yes" : "no"} ·
          Platform role: {me.user.platformRole ?? "none"}
        </p>
        {me.onboarding ? (
          <p className="muted">
            Onboarding state: {me.onboarding.state} —{" "}
            <Link href={me.onboarding.nextStep}>continue</Link>
          </p>
        ) : null}
        <button className="secondary" onClick={() => logout(false)}>
          Sign out
        </button>{" "}
        <button className="secondary" onClick={() => logout(true)}>
          Sign out of all sessions
        </button>
      </Card>
 
      <Card title="Firm memberships">
        {me.memberships.length === 0 ? (
          <p className="muted">No firm membership yet. Approval grants your first membership.</p>
        ) : (
          <ul>
            {me.memberships.map((membership) => (
              <li key={membership.firmId}>
                <Link href={`/firms/${membership.firmId}`}>{membership.firmName}</Link> —{" "}
                {membership.role} ({membership.firmStatus})
              </li>
            ))}
          </ul>
        )}
      </Card>
 
      <Card title="Active sessions">
        <table>
          <thead>
            <tr>
              <th>Started</th>
              <th>Last active</th>
              <th>IP</th>
              <th>Device</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>{new Date(session.createdAt).toLocaleString()}</td>
                <td>{new Date(session.lastActiveAt).toLocaleString()}</td>
                <td>{session.ipAddress ?? "—"}</td>
                <td>{session.userAgent?.slice(0, 40) ?? "—"}</td>
                <td>
                  {session.current ? (
                    <span className="muted">current</span>
                  ) : (
                    <button className="danger" onClick={() => revoke(session.id)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
 
      <Card title="Change password">
        <form onSubmit={changePassword}>
          <Field label="Current password" name="currentPassword" type="password" />
          <Field label="New password" name="password" type="password" />
          <Field label="Confirm new password" name="confirmPassword" type="password" />
          <button type="submit">Update password</button>
        </form>
        <Status error={error} message={message} />
      </Card>
    </>
  );
}