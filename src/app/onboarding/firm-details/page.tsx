"use client";
 
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Card, Field, Select, Status, formValues } from "@/components/form";
 
export default function FirmDetailsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
 
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await api("/api/onboarding/firm-details", {
      body: formValues(event.currentTarget),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/onboarding/review");
  }
 
  return (
    <Card title="Firm details">
      <form onSubmit={onSubmit}>
        <Field label="Firm name" name="name" />
        <Select
          label="Firm type"
          name="type"
          options={[
            { value: "SOLE_PROPRIETORSHIP", label: "Sole proprietorship" },
            { value: "PARTNERSHIP", label: "Partnership" },
            { value: "LLP", label: "LLP" },
            { value: "COMPANY", label: "Company" },
          ]}
        />
        <Field label="Address (optional)" name="addressLine" required={false} />
        <Field label="City (optional)" name="city" required={false} />
        <Field label="State (optional)" name="state" required={false} />
        <Field label="Country code" name="country" defaultValue="IN" />
        <Field label="Firm contact email" name="contactEmail" type="email" />
        <Field label="Firm contact phone (optional)" name="contactPhone" required={false} />
        <Field label="Firm registration number (optional)" name="registrationNumber" required={false} />
        <button type="submit">Save and continue</button>
      </form>
      <Status error={error} />
    </Card>
  );
}