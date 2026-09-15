export type EmailTemplate =
  | "EMAIL_VERIFICATION"
  | "PASSWORD_RESET"
  | "FIRM_INVITATION"
  | "ACCOUNT_SUPPORT"
  | "APPLICATION_DECISION";
 
export type EmailMessage = {
  to: string;
  subject: string;
  template: EmailTemplate;
  /** Template variables. Never include raw secrets beyond single-use action links. */
  variables: Record<string, string>;
  text: string;
};
 
export type EmailDeliveryResult = {
  id: string;
  provider: string;
  deliveredAt: Date;
};
 
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}