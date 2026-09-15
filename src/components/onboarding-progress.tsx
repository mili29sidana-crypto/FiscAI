"use client";
 
const STEPS = [
  "ACCOUNT_CREATED",
  "EMAIL_VERIFIED",
  "ACCOUNT_TYPE_SELECTED",
  "CA_DETAILS_PENDING",
  "FIRM_DETAILS_PENDING",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "COMPLETED",
];
 
export function OnboardingProgress({ state }: { state: string }) {
  return (
    <ol className="states">
      {STEPS.map((step) => (
        <li key={step} className={step === state ? "current" : undefined}>
          {step.toLowerCase().replaceAll("_", " ")}
        </li>
      ))}
    </ol>
  );
}