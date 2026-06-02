import nodemailer from "nodemailer";

type PickupMailPayload = {
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  html?: string | null;
  replyTo?: string | null;
};

type MailResult =
  | {
      status: "sent";
      messageId: string;
    }
  | {
      status: "skipped";
      reason: string;
    }
  | {
      status: "failed";
      reason: string;
    };

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}

export async function sendPickupNotificationEmail(payload: PickupMailPayload): Promise<MailResult> {
  return sendTransactionalEmail(payload);
}

export async function sendTransactionalEmail(payload: PickupMailPayload): Promise<MailResult> {
  if (!payload.to || !payload.from) {
    return {
      status: "skipped",
      reason: "Empfaenger oder Praxis-Absender fehlen.",
    };
  }

  if (!smtpConfigured()) {
    return {
      status: "skipped",
      reason: "SMTP ist nicht konfiguriert.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    });

    const mailOptions = {
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.bodyText,
      html: payload.html ?? undefined,
      replyTo: payload.replyTo ?? payload.from,
    };

    const result = await transporter.sendMail(mailOptions as never);

    return {
      status: "sent",
      messageId: result.messageId,
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Mailversand fehlgeschlagen.",
    };
  }
}
