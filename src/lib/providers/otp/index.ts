/**
 * Phone OTP is deferred for Layer 1 (no SMS vendor is configured). The interface
 * is defined so an implementation can be added without touching call sites:
 * store only OTP hashes, expire in <= 5 minutes, cap attempts, and invalidate
 * previous codes on resend. See docs/architecture-decisions.md.
 */
export type OtpChannel = "SMS" | "WHATSAPP";
 
export type OtpSendRequest = {
  phoneNumber: string;
  channel: OtpChannel;
  purpose: "PHONE_VERIFICATION" | "STEP_UP";
};
 
export type OtpSendResult = {
  /** Hash of the generated code. Raw codes must never be persisted or logged. */
  codeHash: string;
  expiresAt: Date;
  providerReference: string | null;
};
 
export interface OtpProvider {
  readonly name: string;
  send(request: OtpSendRequest): Promise<OtpSendResult>;
}
 
export function getOtpProvider(): OtpProvider | null {
  return null;
}