import { getEnv } from "../../env";
import { logger } from "../../logger";
 
export type CaVerificationOutcome = "VERIFIED" | "NEEDS_MANUAL_REVIEW" | "REJECTED";
 
export type CaVerificationRequest = {
  membershipNumber: string;
  professionalName: string;
  copClaimed?: boolean;
};
 
export type CaVerificationResult = {
  outcome: CaVerificationOutcome;
  providerReference: string | null;
  copVerified: boolean | null;
  message: string;
};
 
export interface CaVerificationProvider {
  readonly name: string;
  verifyMembership(request: CaVerificationRequest): Promise<CaVerificationResult>;
}
 
/**
 * Development provider. It performs format checks only and never asserts a real
 * ICAI verification: anything plausible is routed to manual review.
 */
class MockCaVerificationProvider implements CaVerificationProvider {
  readonly name = "mock";
 
  async verifyMembership(request: CaVerificationRequest): Promise<CaVerificationResult> {
    const normalized = request.membershipNumber.trim();
    if (!/^\d{6}$/.test(normalized)) {
      return {
        outcome: "REJECTED",
        providerReference: null,
        copVerified: null,
        message: "ICAI membership numbers are six digits",
      };
    }
    return {
      outcome: "NEEDS_MANUAL_REVIEW",
      providerReference: `mock-${normalized}`,
      copVerified: request.copClaimed ? null : false,
      message: "Mock provider cannot assert ICAI status; queued for manual review",
    };
  }
}
 
/** Production default until a vendor integration exists: always manual review. */
class ManualCaVerificationProvider implements CaVerificationProvider {
  readonly name = "manual";
 
  async verifyMembership(): Promise<CaVerificationResult> {
    return {
      outcome: "NEEDS_MANUAL_REVIEW",
      providerReference: null,
      copVerified: null,
      message: "Manual reviewer verification required",
    };
  }
}
 
let provider: CaVerificationProvider | null = null;
 
export function getCaVerificationProvider(): CaVerificationProvider {
  if (provider) return provider;
  provider =
    getEnv().CA_VERIFICATION_PROVIDER === "mock"
      ? new MockCaVerificationProvider()
      : new ManualCaVerificationProvider();
  return provider;
}
 
export function setCaVerificationProvider(next: CaVerificationProvider | null): void {
  provider = next;
}
 
export async function verifyCaMembership(
  request: CaVerificationRequest,
): Promise<CaVerificationResult> {
  try {
    return await getCaVerificationProvider().verifyMembership(request);
  } catch (error) {
    logger.error("ca_verification_provider_error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      outcome: "NEEDS_MANUAL_REVIEW",
      providerReference: null,
      copVerified: null,
      message: "Verification provider unavailable; queued for manual review",
    };
  }
}