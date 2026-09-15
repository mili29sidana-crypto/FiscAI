"use client";
 
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Card, Field, Status, formValues } from "@/components/form";
 
export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
 
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await api<{ message: string; devToken?: string }>(
      "/api/auth/forgot-password",
      { body: formValues(event.currentTarget) },
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
    setDevToken(result.data.devToken ?? null);
  }
 
  return (
    <Card title="Forgot password">
      <form onSubmit={onSubmit}>
        <Field label="Email" name="email" type="email" />
        <button type="submit">Send reset link</button>
      </form>
      <Status error={error} message={message} />
      {devToken ? (
        <p className="muted">
          Development reset link:{" "}
          <Link href={`/reset-password?token=${devToken}`}>reset your password</Link>
        </p>
      ) : null}
    </Card>
  );
}