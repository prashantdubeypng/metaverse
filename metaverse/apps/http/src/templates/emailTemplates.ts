/**
 * Email templates for password reset and other notifications
 * In production, use a proper email template engine like MJML or Handlebars
 */

export interface PasswordResetData {
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}

export interface PasswordChangedData {
  name: string;
  ip: string;
  time: string;
}

/**
 * Password reset email template
 */
export function passwordResetTemplate(data: PasswordResetData): { html: string; text: string } {
  const { name, resetUrl, expiresMinutes } = data;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      
      <p>We received a request to reset your password. Click the button below to set a new password:</p>
      
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>
      
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
      
      <div class="warning">
        <strong>⚠️ Important:</strong>
        <ul>
          <li>This link expires in ${expiresMinutes} minutes</li>
          <li>This link can only be used once</li>
          <li>If you didn't request this, please ignore this email</li>
        </ul>
      </div>
      
      <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      
      <p>For security reasons, we recommend:</p>
      <ul>
        <li>Using a strong, unique password</li>
        <li>Not sharing your password with anyone</li>
        <li>Enabling two-factor authentication if available</li>
      </ul>
      
      <p>Thanks,<br>The Metaverse Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply.</p>
      <p>If you need help, contact our support team.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  const text = `
Reset Your Password

Hi ${name},

We received a request to reset your password. Click the link below to set a new password:

${resetUrl}

IMPORTANT:
- This link expires in ${expiresMinutes} minutes
- This link can only be used once
- If you didn't request this, please ignore this email

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

For security reasons, we recommend:
- Using a strong, unique password
- Not sharing your password with anyone
- Enabling two-factor authentication if available

Thanks,
The Metaverse Team

---
This is an automated email. Please do not reply.
If you need help, contact our support team.
  `;
  
  return { html, text };
}

/**
 * Password changed confirmation email template
 */
export function passwordChangedTemplate(data: PasswordChangedData): { html: string; text: string } {
  const { name, ip, time } = data;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
    .alert { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
    .info-box { background: white; border: 1px solid #e5e7eb; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Password Changed Successfully</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      
      <p>Your password was successfully changed.</p>
      
      <div class="info-box">
        <strong>Change Details:</strong>
        <ul style="margin: 10px 0;">
          <li><strong>Time:</strong> ${new Date(time).toLocaleString()}</li>
          <li><strong>IP Address:</strong> ${ip}</li>
        </ul>
      </div>
      
      <div class="alert">
        <strong>⚠️ Didn't make this change?</strong>
        <p>If you didn't change your password, your account may be compromised. Please:</p>
        <ol>
          <li>Contact our support team immediately</li>
          <li>Reset your password again</li>
          <li>Review your recent account activity</li>
        </ol>
      </div>
      
      <p><strong>Security Tips:</strong></p>
      <ul>
        <li>Never share your password with anyone</li>
        <li>Use a unique password for each service</li>
        <li>Enable two-factor authentication</li>
        <li>Be cautious of phishing emails</li>
      </ul>
      
      <p>Thanks,<br>The Metaverse Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply.</p>
      <p>If you need help, contact our support team.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  const text = `
Password Changed Successfully

Hi ${name},

Your password was successfully changed.

Change Details:
- Time: ${new Date(time).toLocaleString()}
- IP Address: ${ip}

⚠️ DIDN'T MAKE THIS CHANGE?

If you didn't change your password, your account may be compromised. Please:
1. Contact our support team immediately
2. Reset your password again
3. Review your recent account activity

Security Tips:
- Never share your password with anyone
- Use a unique password for each service
- Enable two-factor authentication
- Be cautious of phishing emails

Thanks,
The Metaverse Team

---
This is an automated email. Please do not reply.
If you need help, contact our support team.
  `;
  
  return { html, text };
}

export interface WelcomeData {
  name: string;
  loginUrl: string;
}

/**
 * Welcome email template
 */
export function welcomeTemplate(data: WelcomeData): { html: string; text: string } {
  const { name, loginUrl } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Metaverse</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Metaverse! 🎉</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      
      <p>Welcome to Metaverse! Your account has been successfully created.</p>
      
      <div style="text-align: center;">
        <a href="${loginUrl}" class="button">Get Started</a>
      </div>
      
      <p>Thanks,<br>The Metaverse Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Welcome to Metaverse!

Hi ${name},

Welcome to Metaverse! Your account has been successfully created.

Get started: ${loginUrl}

Thanks,
The Metaverse Team
  `;

  return { html, text };
}

/**
 * Get email template by name
 */
export function getEmailTemplate(
  template: 'password_reset' | 'password_changed' | 'welcome',
  data: any
): { html: string; text: string } {
  switch (template) {
    case 'password_reset':
      return passwordResetTemplate(data);
    case 'password_changed':
      return passwordChangedTemplate(data);
    case 'welcome':
      return welcomeTemplate(data);
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}
