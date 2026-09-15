"use client";
 
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { Card, Field, Status, formValues } from "@/components/form";
 
function VerifyEmail() {
  const searchParams = useSearchParams();
  const tokenFromLink = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
 
  const verify = useCallback(async (token: string) => {
    setError(null);
    setMessage(null);
    const result = await api<{ message: string }>("/api/auth/verify-email", { body: { token } });
    if (result.ok) setMessage(result.data.message);
    else setError(result.error);
  }, []);
 
  useEffect(() => {
    if (tokenFromLink) void verify(tokenFromLink);
  }, [tokenFromLink, verify]);
 
  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await api<{ message: string; devToken?: string }>(
      "/api/auth/resend-verification",
      { body: formValues(event.currentTarget) },
    );
    if (result.ok) setMessage(result.data.message);
    else setError(result.error);
  }
 
  return (
    <>
      <Card title="Verify your email">
        <Status error={error} message={message} />
        {message ? (
          <p>
            <Link href="/login">Continue to sign in</Link>
          </p>
        ) : (
          <p className="muted">Open the verification link sent to your email address.</p>
        )}
      </Card>
      <Card title="Resend verification email">
        <form onSubmit={resend}>
          <Field label="Email" name="email" type="email" />
          <button type="submit">Resend</button>
        </form>
      </Card>
    </>
  );
}
 
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <VerifyEmail />
    </Suspense>
  );
}