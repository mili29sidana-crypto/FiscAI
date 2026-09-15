"use client";
 
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Card, Field, Status, formValues } from "@/components/form";
 
export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
 
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await api<{ message: string; devToken?: string }>("/api/auth/register", {
      body: formValues(event.currentTarget),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
    setDevToken(result.data.devToken ?? null);
  }
 
  return (
    <Card title="Create your account">
      <form onSubmit={onSubmit}>
        <Field label="First name" name="firstName" />
        <Field label="Last name" name="lastName" />
        <Field label="Email" name="email" type="email" />
        <Field label="Phone (optional)" name="phoneNumber" required={false} />
        <Field label="Password" name="password" type="password" />
        <Field label="Confirm password" name="confirmPassword" type="password" />
        <p className="muted">
          At least 12 characters with upper and lower case letters, a digit, and a symbol.
        </p>
        <button type="submit" disabled={busy}>
          Create account
        </button>
      </form>
      <Status error={error} message={message} />
      {devToken ? (
        <p className="muted">
          Development verification link:{" "}
          <Link href={`/verify-email?token=${devToken}`}>verify this email</Link>
        </p>
      ) : null}
      <p className="muted">
        Already registered? <Link href="/login">Sign in</Link>
      </p>
    </Card>
  );
}