"use client";
 
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Card, Status } from "@/components/form";
import { OnboardingProgress } from "@/components/onboarding-progress";
 
type View = {
  state: string;
  accountType: string | null;
  editable: boolean;
  nextStep: string;
  rejectionReason: string | null;
  infoRequested: string | null;
};
 
export default function OnboardingPage() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
 
  useEffect(() => {
    void api<View>("/api/onboarding").then((result) => {
      if (result.ok) setView(result.data);
      else setError(result.error);
    });
  }, []);
 
  if (!view) {
    return (
      <Card title="Onboarding">
        <Status error={error} />
        <p className="muted">
          <Link href="/login">Sign in</Link> to resume onboarding.
        </p>
      </Card>
    );
  }
 
  return (
    <Card title="Onboarding">
      <p className="muted">
        Current state: <strong>{view.state}</strong>
        {view.accountType ? ` · account type ${view.accountType}` : ""}
      </p>
      <OnboardingProgress state={view.state} />
      {view.infoRequested ? <p className="error">Reviewer request: {view.infoRequested}</p> : null}
      {view.rejectionReason ? <p className="error">Rejected: {view.rejectionReason}</p> : null}
      <p>
        <Link href={view.nextStep}>Continue onboarding</Link>
      </p>
    </Card>
  );
}