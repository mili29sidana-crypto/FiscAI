"use client";
 
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { Card, Field, Status, formValues } from "@/components/form";
 
function ResetPassword() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
 
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await api<{ message: string }>("/api/auth/reset-password", {
      body: formValues(event.currentTarget),
    });
    if (result.ok) setMessage(result.data.message);
    else setError(result.error);
  }
 
  return (
    <Card title="Choose a new password">
      <form onSubmit={onSubmit}>
        <Field label="Reset token" name="token" defaultValue={searchParams.get("token") ?? ""} />
        <Field label="New password" name="password" type="password" />
        <Field label="Confirm new password" name="confirmPassword" type="password" />
        <button type="submit">Update password</button>
      </form>
      <Status error={error} message={message} />
      {message ? (
        <p>
          <Link href="/login">Sign in with your new password</Link>
        </p>
      ) : null}
    </Card>
  );
}
 
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <ResetPassword />
    </Suspense>
  );
}