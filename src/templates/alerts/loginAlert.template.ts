import { LoginAlertData } from "../../types/emailAlert.types";

export function buildLoginAlertEmail(data: LoginAlertData) {
  const loginTime = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  });

  const subject = `🔐 New Login Alert - ${data.email}`;

  const text = `
JIVA Digital LCSA Security Alert — New Login Detected

We noticed a new login to your LCA account.

User Email: ${data.email}
User Name: ${data.userName ?? "N/A"}
User ID: ${data.userId ?? "N/A"}
Company Name: ${data.companyName ?? "N/A"}
Company ID: ${data.companyId ?? "N/A"}
Correlation ID: ${data.correlationId ?? "N/A"}
Login Time: ${loginTime} (IST)

If this was you, no action is needed.
If you don't recognize this activity, please contact your administrator or reset your password immediately.
  `;

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td style="background-color:#0f2540; padding:24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <span style="font-size:20px; font-weight:bold; color:#ffffff; letter-spacing:0.3px;">JIVA Digital LCSA</span>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="background-color:#16a34a; color:#ffffff; font-size:11px; font-weight:bold; padding:4px 10px; border-radius:12px; text-transform:uppercase; letter-spacing:0.5px;">
                        Security Alert
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Icon + Title -->
            <tr>
              <td style="padding:32px 32px 8px 32px; text-align:center;">
                <div style="width:56px; height:56px; background-color:#e8f0fe; border-radius:50%; margin:0 auto 16px auto; line-height:56px; font-size:26px;">
                  🔐
                </div>
                <h1 style="margin:0; font-size:20px; color:#0f2540; font-weight:700;">
                  New Login Detected
                </h1>
                <p style="margin:8px 0 0 0; font-size:14px; color:#5f6b7a; line-height:1.5;">
                  A successful login was just made to your LCA account.
                </p>
              </td>
            </tr>

            <!-- Details Card -->
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9ee; border-radius:6px; overflow:hidden;">
                  <tr>
                    <td style="padding:14px 16px; background-color:#f9fafb; border-bottom:1px solid #e5e9ee; font-size:13px; color:#5f6b7a; width:40%;">User Email</td>
                    <td style="padding:14px 16px; background-color:#f9fafb; border-bottom:1px solid #e5e9ee; font-size:13px; color:#0f2540; font-weight:600;">${data.email}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #e5e9ee; font-size:13px; color:#5f6b7a;">User Name</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #e5e9ee; font-size:13px; color:#0f2540; font-weight:600;">${data.userName ?? "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #e5e9ee; font-size:13px; color:#5f6b7a;">User ID</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #e5e9ee; font-size:13px; color:#0f2540; font-weight:600;">${data.userId ?? "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; background-color:#f9fafb; border-bottom:1px solid #e5e9ee; font-size:13px; color:#5f6b7a;">Company Name</td>
                    <td style="padding:14px 16px; background-color:#f9fafb; border-bottom:1px solid #e5e9ee; font-size:13px; color:#0f2540; font-weight:600;">${data.companyName ?? "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; background-color:#f9fafb; border-bottom:1px solid #e5e9ee; font-size:13px; color:#5f6b7a;">Company ID</td>
                    <td style="padding:14px 16px; background-color:#f9fafb; border-bottom:1px solid #e5e9ee; font-size:13px; color:#0f2540; font-weight:600;">${data.companyId ?? "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; border-bottom:1px solid #e5e9ee; font-size:13px; color:#5f6b7a;">Correlation ID</td>
                    <td style="padding:14px 16px; border-bottom:1px solid #e5e9ee; font-size:13px; color:#0f2540; font-weight:600; font-family:'Courier New', monospace;">${data.correlationId ?? "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px; background-color:#f9fafb; font-size:13px; color:#5f6b7a;">Login Time</td>
                    <td style="padding:14px 16px; background-color:#f9fafb; font-size:13px; color:#0f2540; font-weight:600;">${loginTime} (IST)</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Notice -->
            <tr>
              <td style="padding:24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff8e6; border:1px solid #f5deb3; border-radius:6px;">
                  <tr>
                    <td style="padding:14px 16px; font-size:13px; color:#7a5c00; line-height:1.6;">
                      <strong>Wasn't you?</strong> If you don't recognize this login, please contact your administrator or reset your password immediately.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px; background-color:#f9fafb; border-top:1px solid #e5e9ee; text-align:center;">
                <p style="margin:0; font-size:12px; color:#9aa5b1;">
                  This is an automated security notification from JIVA Digital LCSA. Please do not reply to this email.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;

  return { subject, text, html };
}
