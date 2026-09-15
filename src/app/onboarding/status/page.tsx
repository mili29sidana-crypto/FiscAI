"use client";
 
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Card, Status } from "@/components/form";
import { OnboardingProgress } from "@/components/onboarding-progress";
 
type View = {
  state: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  infoRequested: string | null;
  firm: { id: string; name: string; status: string } | null;
};
 
export default function OnboardingStatusPage() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
 
  useEffect(() => {
    void api<View>("/api/onboarding").then((result) => {
      if (result.ok) setView(result.data);
      else setError(result.error);
    });
  }, []);
 
  return (
    <Card title="Application status">
      <Status error={error} />
      {view ? (
        <>
          <p>
            State: <strong>{view.state}</strong>
          </p>
          <OnboardingProgress state={view.state} />
          {view.submittedAt ? (
            <p className="muted">Submitted {new Date(view.submittedAt).toLocaleString()}</p>
          ) : null}
          {view.infoRequested ? (
            <p className="error">Reviewer needs more information: {view.infoRequested}</p>
          ) : null}
          {view.rejectionReason ? (
            <p className="error">
              Rejected: {view.rejectionReason} —{" "}
              <Link href="/onboarding/rejected">correct and resubmit</Link>
            </p>
          ) : null}
          {view.state === "COMPLETED" || view.state === "APPROVED" ? (
            <p className="success">
              Approved. <Link href="/workspace">Enter your workspace</Link> (sign in again — your
              sessions were rotated when the role was granted).
            </p>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}