import { getEnv } from "../../env";
import type { EmailMessage } from "./types";
 
function appUrl(pathname: string, params: Record<string, string> = {}): string {
  const url = new URL(pathname, getEnv().APP_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
 
export function verificationEmail(to: string, token: string): EmailMessage {
  const link = appUrl("/verify-email", { token });
  return {
    to,
    subject: "Verify your CA Tax OS email address",
    template: "EMAIL_VERIFICATION",
    variables: { link },
    text: `Confirm your email address to continue onboarding:\n${link}\n\nThis link expires in 24 hours.`,
  };
}
 
export function passwordResetEmail(to: string, token: string): EmailMessage {
  const link = appUrl("/reset-password", { token });
  return {
    to,
    subject: "Reset your CA Tax OS password",
    template: "PASSWORD_RESET",
    variables: { link },
    text: `Reset your password using the link below:\n${link}\n\nThis link expires in 60 minutes and can be used once.`,
  };
}
 
export function firmInvitationEmail(to: string, token: string, firmName: string): EmailMessage {
  const link = appUrl(`/invitations/${token}`);
  return {
    to,
    subject: `You have been invited to join ${firmName} on CA Tax OS`,
    template: "FIRM_INVITATION",
    variables: { link, firmName },
    text: `${firmName} invited you to their CA Tax OS workspace.\nAccept the invitation:\n${link}\n\nThis invitation expires in 7 days.`,
  };
}
 
export function applicationDecisionEmail(
  to: string,
  decision: "APPROVED" | "REJECTED" | "INFORMATION_REQUESTED",
  detail?: string,
): EmailMessage {
  const link = appUrl("/onboarding/status");
  return {
    to,
    subject: `Your CA Tax OS application was ${decision.toLowerCase().replace("_", " ")}`,
    template: "APPLICATION_DECISION",
    variables: { decision, link, detail: detail ?? "" },
    text: `Your onboarding application status is now ${decision}.${
      detail ? `\n\nReviewer note: ${detail}` : ""
    }\n\nView details: ${link}`,
  };
}
 
export function accountSupportEmail(to: string, reason: string): EmailMessage {
  const link = appUrl("/support");
  return {
    to,
    subject: "CA Tax OS account support",
    template: "ACCOUNT_SUPPORT",
    variables: { reason, link },
    text: `A support request was raised for your account (${reason}).\nOur team will contact you.\n${link}`,
  };
}