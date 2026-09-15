import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { getEnv } from "../../env";
import { logger } from "../../logger";
import type { EmailDeliveryResult, EmailMessage, EmailProvider } from "./types";
 
export type { EmailMessage, EmailProvider, EmailTemplate } from "./types";
 
function logDelivery(provider: string, message: EmailMessage, id: string): void {
  logger.info("email_dispatched", {
    provider,
    id,
    template: message.template,
    recipientDomain: message.to.split("@")[1] ?? "unknown",
  });
}
 
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
 
  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const id = randomUUID();
    logDelivery(this.name, message, id);
    if (getEnv().NODE_ENV !== "production") {
      console.log(`\n--- DEV EMAIL (${message.template}) ---\nTo: ${message.to}\nSubject: ${message.subject}\n${message.text}\n---\n`);
    }
    return { id, provider: this.name, deliveredAt: new Date() };
  }
}
 
/** Writes messages to a local outbox directory so /dev/mail can render them. */
class FilesystemEmailProvider implements EmailProvider {
  readonly name = "filesystem";
 
  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const env = getEnv();
    const id = randomUUID();
    const dir = path.resolve(process.cwd(), env.EMAIL_OUTBOX_DIR);
    await mkdir(dir, { recursive: true });
    const record = {
      id,
      to: message.to,
      from: env.EMAIL_FROM,
      subject: message.subject,
      template: message.template,
      variables: message.variables,
      text: message.text,
      sentAt: new Date().toISOString(),
    };
    await writeFile(path.join(dir, `${Date.now()}-${id}.json`), JSON.stringify(record, null, 2));
    logDelivery(this.name, message, id);
    return { id, provider: this.name, deliveredAt: new Date() };
  }
}
 
/**
 * Placeholder for a real SMTP/API provider. Wiring a vendor SDK here is the only
 * change required for production delivery; retries are applied by the caller.
 */
class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
 
  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const env = getEnv();
    if (!env.SMTP_HOST || !env.SMTP_PORT) {
      throw new Error("SMTP_HOST and SMTP_PORT must be configured for the smtp email provider");
    }
    const id = randomUUID();
    logDelivery(this.name, message, id);
    throw new Error("SMTP transport is not implemented yet. Configure a provider SDK.");
  }
}
 
let provider: EmailProvider | null = null;
 
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  switch (getEnv().EMAIL_PROVIDER) {
    case "console":
      provider = new ConsoleEmailProvider();
      break;
    case "smtp":
      provider = new SmtpEmailProvider();
      break;
    default:
      provider = new FilesystemEmailProvider();
  }
  return provider;
}
 
export function setEmailProvider(next: EmailProvider | null): void {
  provider = next;
}
 
export async function sendEmail(message: EmailMessage, attempts = 2): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await getEmailProvider().send(message);
      return;
    } catch (error) {
      lastError = error;
      logger.warn("email_delivery_failed", { template: message.template, attempt });
    }
  }
  logger.error("email_delivery_abandoned", {
    template: message.template,
    message: lastError instanceof Error ? lastError.message : "unknown",
  });
}