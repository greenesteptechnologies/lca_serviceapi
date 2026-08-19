import { transporter } from "../config/mailer";
import { ENV } from "../config/env";
import { LoginAlertData, RegistrationAlertData } from "../types/emailAlert.types";
import { buildLoginAlertEmail } from "../templates/alerts/loginAlert.template";
import { buildRegistrationAlertEmail } from "../templates/alerts/registrationAlert.template";

export async function sendLoginAlertEmail(data: LoginAlertData): Promise<void> {
  const { subject, text, html } = buildLoginAlertEmail(data);

  await transporter.sendMail({
    from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_ALERT_FROM}>`,
    to: ENV.SMTP_ALERT_TO,
    subject,
    text,
    html,
  });
}

export async function sendOnboardingAlertEmail(data: RegistrationAlertData): Promise<void> {
  const { subject, text, html } = buildRegistrationAlertEmail(data);

  await transporter.sendMail({
    from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_ALERT_FROM}>`,
    to: ENV.SMTP_ALERT_TO,
    subject,
    text,
    html,
  });
}