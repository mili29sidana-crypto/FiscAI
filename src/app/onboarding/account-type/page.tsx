"use client";
 
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Card, Select, Status, formValues } from "@/components/form";
 
export default function AccountTypePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
 
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await api<{ nextStep: string }>("/api/onboarding/account-type", {
      body: formValues(event.currentTarget),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.data.nextStep);
  }
 
  return (
    <Card title="Select account type">
      <form onSubmit={onSubmit}>
        <Select
          label="Account type"
          name="accountType"
          options={[
            { value: "CA", label: "Chartered Accountant (practising)" },
            { value: "STAFF", label: "Firm staff" },
            { value: "CLIENT", label: "Client" },
          ]}
        />
        <button type="submit">Continue</button>
      </form>
      <Status error={error} />
    </Card>
  );
}