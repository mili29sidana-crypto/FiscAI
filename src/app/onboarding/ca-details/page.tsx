"use client";
 
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Card, Field, Select, Status, formValues } from "@/components/form";
 
export default function CaDetailsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
 
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await api("/api/onboarding/ca-details", {
      body: formValues(event.currentTarget),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/onboarding/firm-details");
  }
 
  return (
    <Card title="Chartered Accountant details">
      <p className="muted">
        Membership details are recorded for platform review. No live ICAI integration exists yet,
        so a reviewer confirms membership manually before approval.
      </p>
      <form onSubmit={onSubmit}>
        <Field label="ICAI membership number" name="icaiMembershipNumber" placeholder="123456" />
        <Field label="Name as per ICAI records" name="professionalName" />
        <Field label="Practice name (optional)" name="practiceName" required={false} />
        <Select
          label="Certificate of practice"
          name="copStatus"
          options={[
            { value: "HELD", label: "Held" },
            { value: "APPLIED", label: "Applied" },
            { value: "NOT_HELD", label: "Not held" },
          ]}
        />
        <Field
          label="Supporting reference (optional)"
          name="supportingReference"
          required={false}
        />
        <button type="submit">Save and continue</button>
      </form>
      <Status error={error} />
    </Card>
  );
}