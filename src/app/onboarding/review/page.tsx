"use client";
 
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Card, Status } from "@/components/form";
 
type View = {
  state: string;
  accountType: string | null;
  caProfile: { icaiMembershipNumber: string; professionalName: string } | null;
  firm: { name: string; type: string; contactEmail: string } | null;
};
 
export default function OnboardingReviewPage() {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
 
  useEffect(() => {
    void api<View>("/api/onboarding").then((result) => {
      if (result.ok) setView(result.data);
      else setError(result.error);
    });
  }, []);
 
  async function submit() {
    setBusy(true);
    setError(null);
    const result = await api("/api/onboarding/submit", { body: {} });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/onboarding/status");
  }
 
  return (
    <Card title="Review and submit">
      <Status error={error} />
      {view ? (
        <>
          <p className="muted">Account type: {view.accountType ?? "—"}</p>
          {view.caProfile ? (
            <p className="muted">
              CA: {view.caProfile.professionalName} (membership{" "}
              {view.caProfile.icaiMembershipNumber})
            </p>
          ) : null}
          {view.firm ? (
            <p className="muted">
              Firm: {view.firm.name} · {view.firm.type} · {view.firm.contactEmail}
            </p>
          ) : null}
          <p className="muted">
            After submission the application is read-only until a platform reviewer approves it or
            requests changes.
          </p>
          <button onClick={submit} disabled={busy}>
            Submit for verification
          </button>
        </>
      ) : null}
    </Card>
  );
}