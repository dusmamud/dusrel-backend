/**
 * Mail sending interface for auth-api.
 *
 * v1 reality: the real sender (Dusrel's own Stalwart SMTP on the VPS)
 * does not exist yet — Stalwart is a VPS step, not a sandbox step.
 * So the running server uses LogMailSender, which logs only the
 * recipient and subject, NEVER the message text (which may contain a
 * reset/invite link or an OTP). Tests use CapturingMailSender so a
 * flow can be verified end-to-end without a mail server, and without
 * ever returning a token in an API response.
 */

export interface MailMessage {
  subject: string;
  text: string;
  to: string;
}

export interface MailSender {
  send(message: MailMessage): Promise<void>;
}

export class LogMailSender implements MailSender {
  async send(message: MailMessage): Promise<void> {
    console.log(`[mail] to=${message.to} subject=${message.subject}`);
  }
}

export class CapturingMailSender implements MailSender {
  messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  lastTo(to: string): MailMessage | undefined {
    return [...this.messages].reverse().find((m) => m.to === to);
  }
}
