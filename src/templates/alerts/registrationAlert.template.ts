import { RegistrationAlertData } from "../../types/emailAlert.types";

const escapeHtml = (value: unknown) =>
  String(value ?? "N/A")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatRegistrationTime = (registeredAt?: string) => {
  if (!registeredAt) return "N/A";
  const date = new Date(registeredAt);

  return Number.isNaN(date.getTime())
    ? registeredAt
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Kolkata",
      });
};

export function buildRegistrationAlertEmail(data: RegistrationAlertData) {
  const subject = `New Registration Alert - ${data.email}`;
  const fields: Array<[string, unknown]> = [
    ["User Email", data.email],
    ["User Name", data.userName],
    ["User ID", data.userId],
    ["Company Name", data.companyName],
    ["Company ID", data.companyId],
    ["Role", data.role],
    ["Phone Number", data.phoneNumber],
    ["Company Type", data.companyType],
    ["Industry", data.industry],
    ["Registration Status", data.registrationStatus],
    ["Registered At", formatRegistrationTime(data.registeredAt)],
    ["Correlation ID", data.correlationId],
  ];

  const text = `
JIVA Digital LCSA Registration Alert — New Registration Received

${fields.map(([label, value]) => `${label}: ${value ?? "N/A"}`).join("\n")}
  `;

  const rows = fields
    .map(
      ([label, value], index) => `
        <tr>
          <td style="padding:14px 16px; ${index % 2 === 0 ? "background-color:#f9fafb; " : ""}border-bottom:1px solid #e5e9ee; font-size:13px; color:#5f6b7a; width:40%;">${escapeHtml(label)}</td>
          <td style="padding:14px 16px; ${index % 2 === 0 ? "background-color:#f9fafb; " : ""}border-bottom:1px solid #e5e9ee; font-size:13px; color:#0f2540; font-weight:600;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:32px 16px;"><tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background-color:#0f2540; padding:24px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><span style="font-size:20px; font-weight:bold; color:#ffffff; letter-spacing:0.3px;">JIVA Digital LCSA</span></td>
          <td align="right"><span style="background-color:#2563eb; color:#ffffff; font-size:11px; font-weight:bold; padding:4px 10px; border-radius:12px; text-transform:uppercase; letter-spacing:0.5px;">Registration Alert</span></td>
        </tr></table></td></tr>
        <tr><td style="padding:32px 32px 8px; text-align:center;">
          <div style="width:56px; height:56px; background-color:#e8f0fe; border-radius:50%; margin:0 auto 16px; line-height:56px; font-size:26px;">✓</div>
          <h1 style="margin:0; font-size:20px; color:#0f2540; font-weight:700;">New Registration Received</h1>
          <p style="margin:8px 0 0; font-size:14px; color:#5f6b7a; line-height:1.5;">A new user registration was submitted to the LCA application.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9ee; border-radius:6px; overflow:hidden;">${rows}</table></td></tr>
        <tr><td style="padding:20px 32px; background-color:#f9fafb; border-top:1px solid #e5e9ee; text-align:center;"><p style="margin:0; font-size:12px; color:#9aa5b1;">This is an automated registration notification from JIVA Digital LCSA. Please do not reply to this email.</p></td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`;

  return { subject, text, html };
}
