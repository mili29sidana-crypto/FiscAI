"use client";
 
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Card, Field, Status, formValues } from "@/components/form";
 
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
 
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api<{ onboarding: { nextStep: string } | null }>("/api/auth/login", {
      body: formValues(event.currentTarget),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.data.onboarding?.nextStep ?? "/dashboard");
    router.refresh();
  }
 
  return (
    <Card title="Sign in">
      <form onSubmit={onSubmit}>
        <Field label="Email" name="email" type="email" />
        <Field label="Password" name="password" type="password" />
        <button type="submit" disabled={busy}>
          Sign in
        </button>
      </form>
      <Status error={error} />
      <p className="muted">
        <Link href="/forgot-password">Forgot password</Link> ·{" "}
        <Link href="/register">Create an account</Link> ·{" "}
        <Link href="/verify-email">Verify email</Link>
      </p>
    </Card>
  );
}