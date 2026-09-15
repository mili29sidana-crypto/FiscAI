import { AccountType, OnboardingState } from "@prisma/client";
import { invalidState } from "../http/errors";
 
export type TransitionActor = "USER" | "PLATFORM" | "SYSTEM";
 
type TransitionRule = {
  to: OnboardingState;
  actors: TransitionActor[];
};
 
/**
 * Server-side transition map. Only PLATFORM actors may move an application to
 * APPROVED or REJECTED; users can never self-approve.
 */
export const TRANSITIONS: Record<OnboardingState, TransitionRule[]> = {
  NOT_STARTED: [{ to: OnboardingState.ACCOUNT_CREATED, actors: ["SYSTEM"] }],
  ACCOUNT_CREATED: [{ to: OnboardingState.EMAIL_VERIFIED, actors: ["SYSTEM"] }],
  EMAIL_VERIFIED: [{ to: OnboardingState.ACCOUNT_TYPE_SELECTED, actors: ["USER"] }],
  ACCOUNT_TYPE_SELECTED: [
    { to: OnboardingState.CA_DETAILS_PENDING, actors: ["USER"] },
    { to: OnboardingState.FIRM_DETAILS_PENDING, actors: ["USER"] },
  ],
  CA_DETAILS_PENDING: [
    { to: OnboardingState.FIRM_DETAILS_PENDING, actors: ["USER"] },
    { to: OnboardingState.SUBMITTED, actors: ["USER"] },
    { to: OnboardingState.ACCOUNT_TYPE_SELECTED, actors: ["USER"] },
  ],
  FIRM_DETAILS_PENDING: [
    { to: OnboardingState.CA_DETAILS_PENDING, actors: ["USER"] },
    { to: OnboardingState.SUBMITTED, actors: ["USER"] },
    { to: OnboardingState.ACCOUNT_TYPE_SELECTED, actors: ["USER"] },
  ],
  SUBMITTED: [
    { to: OnboardingState.UNDER_REVIEW, actors: ["PLATFORM", "SYSTEM"] },
    { to: OnboardingState.APPROVED, actors: ["PLATFORM"] },
    { to: OnboardingState.REJECTED, actors: ["PLATFORM"] },
  ],
  UNDER_REVIEW: [
    { to: OnboardingState.APPROVED, actors: ["PLATFORM"] },
    { to: OnboardingState.REJECTED, actors: ["PLATFORM"] },
    { to: OnboardingState.CA_DETAILS_PENDING, actors: ["PLATFORM"] },
    { to: OnboardingState.FIRM_DETAILS_PENDING, actors: ["PLATFORM"] },
  ],
  APPROVED: [{ to: OnboardingState.COMPLETED, actors: ["SYSTEM"] }],
  REJECTED: [
    { to: OnboardingState.CA_DETAILS_PENDING, actors: ["USER", "PLATFORM"] },
    { to: OnboardingState.FIRM_DETAILS_PENDING, actors: ["USER", "PLATFORM"] },
  ],
  COMPLETED: [],
};
 
export function canTransition(
  from: OnboardingState,
  to: OnboardingState,
  actor: TransitionActor,
): boolean {
  return TRANSITIONS[from].some((rule) => rule.to === to && rule.actors.includes(actor));
}
 
export function assertTransition(
  from: OnboardingState,
  to: OnboardingState,
  actor: TransitionActor,
): void {
  if (!canTransition(from, to, actor)) {
    throw invalidState(`Transition ${from} -> ${to} is not permitted for ${actor}`);
  }
}
 
export function detailsStateFor(accountType: AccountType): OnboardingState {
  return accountType === AccountType.CA
    ? OnboardingState.CA_DETAILS_PENDING
    : OnboardingState.FIRM_DETAILS_PENDING;
}
 
export const EDITABLE_STATES: OnboardingState[] = [
  OnboardingState.ACCOUNT_TYPE_SELECTED,
  OnboardingState.CA_DETAILS_PENDING,
  OnboardingState.FIRM_DETAILS_PENDING,
];
 
export function isEditable(state: OnboardingState): boolean {
  return EDITABLE_STATES.includes(state);
}
 
export function isTerminalForUser(state: OnboardingState): boolean {
  return (
    state === OnboardingState.SUBMITTED ||
    state === OnboardingState.UNDER_REVIEW ||
    state === OnboardingState.APPROVED ||
    state === OnboardingState.COMPLETED
  );
}
 
export function nextUserStep(state: OnboardingState): string {
  switch (state) {
    case OnboardingState.NOT_STARTED:
    case OnboardingState.ACCOUNT_CREATED:
      return "/verify-email";
    case OnboardingState.EMAIL_VERIFIED:
      return "/onboarding/account-type";
    case OnboardingState.ACCOUNT_TYPE_SELECTED:
    case OnboardingState.CA_DETAILS_PENDING:
      return "/onboarding/ca-details";
    case OnboardingState.FIRM_DETAILS_PENDING:
      return "/onboarding/firm-details";
    case OnboardingState.SUBMITTED:
    case OnboardingState.UNDER_REVIEW:
      return "/onboarding/status";
    case OnboardingState.REJECTED:
      return "/onboarding/rejected";
    case OnboardingState.APPROVED:
    case OnboardingState.COMPLETED:
      return "/workspace";
  }
}