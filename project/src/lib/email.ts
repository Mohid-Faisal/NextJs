import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_mock_key_for_build");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(data: EmailData) {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com",
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text || data.html.replace(/<[^>]*>/g, "")
    });

    if (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email");
    }

    return emailData;
  } catch (error) {
    console.error("Error in sendEmail:", error);
    throw error;
  }
}

export interface UserApprovalEmailData {
  userName: string;
  userEmail: string;
  approvalUrl: string;
}

export async function sendUserApprovalEmail(data: UserApprovalEmailData) {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com",
      to: "psswwe@gmail.com",
      subject: "New User Registration Requires Approval",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New User Registration</h2>
          <p>A new user has registered and requires your approval:</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">User Details:</h3>
            <p><strong>Name:</strong> ${escapeHtml(data.userName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(data.userEmail)}</p>
            <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHtml(data.approvalUrl)}"
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review &amp; Approve User
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            Click the button above to review and approve this user registration.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending approval email:", error);
      throw new Error("Failed to send approval email");
    }

    return emailData;
  } catch (error) {
    console.error("Error in sendUserApprovalEmail:", error);
    throw error;
  }
}

export async function sendUserApprovedEmail(
  userEmail: string,
  userName: string
) {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com",
      to: userEmail,
      subject: "Your Account Has Been Approved!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Account Approved!</h2>
          <p>Hello ${escapeHtml(userName)},</p>

          <p>Great news! Your account has been approved by an administrator.</p>

          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Your account is now active and you can log in!</strong></p>
          </div>

          <p>You can now access all the features of our platform.</p>

          <p style="color: #666; font-size: 14px;">
            If you have any questions, please don't hesitate to contact support.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending approval confirmation email:", error);
      throw new Error("Failed to send approval confirmation email");
    }

    return emailData;
  } catch (error) {
    console.error("Error in sendUserApprovedEmail:", error);
    throw error;
  }
}

export async function sendVerificationEmail(
  userEmail: string,
  userName: string,
  verificationCode: string
) {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com",
      to: userEmail,
      subject: "Verify Your Email - Signup",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Our Platform!</h2>
          <p>Hi ${escapeHtml(userName)},</p>
          <p>Thank you for signing up! To complete your registration, please use the verification code below:</p>

          <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
          </div>

          <p><strong>This code will expire in 10 minutes.</strong></p>

          <p>If you didn't request this verification code, please ignore this email.</p>

          <p>Best regards,<br>Your Platform Team</p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending verification email:", error);
      throw new Error("Failed to send verification email");
    }

    return emailData;
  } catch (error) {
    console.error("Error in sendVerificationEmail:", error);
    throw error;
  }
}

export async function send2FACodeEmail(
  userEmail: string,
  userName: string,
  verificationCode: string
) {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com",
      to: userEmail,
      subject: "2FA Verification Code - Shipment Deletion",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Shipment Deletion Verification</h2>
          <p>Hi ${escapeHtml(userName)},</p>
          <p>You have requested to delete a shipment. To complete this action, please use the verification code below:</p>

          <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #721c24; font-size: 32px; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
          </div>

          <p><strong>This code will expire in 10 minutes.</strong></p>

          <p style="color: #721c24; font-weight: bold;">Warning: This action will permanently delete the shipment and all related data. This cannot be undone.</p>

          <p>If you didn't request this verification code, please ignore this email and contact support immediately.</p>

          <p>Best regards,<br>Your Platform Team</p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending 2FA code email:", error);
      throw new Error("Failed to send 2FA code email");
    }

    return emailData;
  } catch (error) {
    console.error("Error in send2FACodeEmail:", error);
    throw error;
  }
}

export async function sendPassword2FACodeEmail(
  userEmail: string,
  userName: string,
  verificationCode: string
) {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com",
      to: userEmail,
      subject: "Security Verification Code - Password Change",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4F46E5;">Security Verification Code</h2>
          <p>Hi ${escapeHtml(userName)},</p>
          <p>You have requested to change your account password. To complete this secure action, please use the verification code below:</p>

          <div style="background: #F3F4F6; border: 1px solid #E5E7EB; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #1F2937; font-size: 32px; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
          </div>

          <p><strong>This code will expire in 10 minutes.</strong></p>

          <p style="color: #4F46E5; font-weight: bold;">Please do not share this code with anyone.</p>

          <p>If you didn't request this verification code, please ignore this email and secure your account immediately.</p>

          <p>Best regards,<br>Your Platform Team</p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending Password 2FA code email:", error);
      throw new Error("Failed to send 2FA code email");
    }

    return emailData;
  } catch (error) {
    console.error("Error in sendPassword2FACodeEmail:", error);
    throw error;
  }
}

export async function sendPasswordResetCodeEmail(
  userEmail: string,
  userName: string,
  verificationCode: string
) {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com",
      to: userEmail,
      subject: "Password Reset Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4F46E5;">Password Reset Request</h2>
          <p>Hi ${escapeHtml(userName)},</p>
          <p>We received a request to reset your account password. Use the verification code below to continue:</p>

          <div style="background: #F3F4F6; border: 1px solid #E5E7EB; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #1F2937; font-size: 32px; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
          </div>

          <p><strong>This code will expire in 10 minutes.</strong></p>

          <p style="color: #dc2626; font-weight: bold;">If you did not request a password reset, ignore this email &mdash; your password will remain unchanged.</p>

          <p>Best regards,<br>Your Platform Team</p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending password reset email:", error);
      throw new Error("Failed to send password reset email");
    }

    return emailData;
  } catch (error) {
    console.error("Error in sendPasswordResetCodeEmail:", error);
    throw error;
  }
}

/**
 * Security alert: sign-in from an IP address not seen before for this user.
 * Best-effort — failures are logged inside, never thrown into the login path.
 */
export async function sendNewDeviceLoginAlertEmail(
  userEmail: string,
  userName: string,
  ip: string | null,
  userAgent: string | null,
  loginTime: Date
): Promise<boolean> {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com",
      to: userEmail,
      subject: "New device sign-in detected",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4F46E5;">New device sign-in detected</h2>
          <p>Hi ${escapeHtml(userName)},</p>
          <p>Your account was just accessed from an IP address we haven't seen before:</p>

          <div style="background: #F3F4F6; border: 1px solid #E5E7EB; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Time:</strong> ${loginTime.toISOString()}</p>
            <p style="margin: 4px 0;"><strong>IP address:</strong> ${ip ? escapeHtml(ip) : "unknown"}</p>
            <p style="margin: 4px 0;"><strong>Device:</strong> ${escapeHtml((userAgent ?? "unknown").slice(0, 200))}</p>
          </div>

          <p style="color: #dc2626; font-weight: bold;">If this wasn't you, reset your password immediately and contact support.</p>

          <p>Best regards,<br>Your Platform Team</p>
        </div>
      `,
    });
    if (error) {
      console.error("Error sending new-device login alert:", error);
      return false;
    }
    return !!emailData;
  } catch (err) {
    console.error("Error in sendNewDeviceLoginAlertEmail:", err);
    return false;
  }
}

export interface EmployeeInvitationEmailData {
  employeeName: string;
  employeeEmail: string;
  initialPassword: string;
  loginUrl: string;
  organizationName: string;
}

export async function sendEmployeeInvitationEmail(data: EmployeeInvitationEmailData) {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com",
      to: data.employeeEmail,
      subject: `You have been added to ${data.organizationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4F46E5;">Welcome to ${escapeHtml(data.organizationName)}!</h2>
          <p>Hello ${escapeHtml(data.employeeName)},</p>
          <p>You have been added as an employee to the <strong>${escapeHtml(data.organizationName)}</strong> workspace by an administrator.</p>

          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">Your Account Credentials:</h3>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${escapeHtml(data.employeeEmail)}</p>
            <p style="margin: 5px 0;"><strong>Initial Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 14px;">${escapeHtml(data.initialPassword)}</code></p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHtml(data.loginUrl)}"
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Log In to Your Account
            </a>
          </div>

          <p style="color: #ef4444; font-size: 13px; font-weight: 500;">
            For security reasons, we strongly recommend that you change your password immediately after logging in.
          </p>

          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #666; font-size: 13px; margin: 0;">
            If you have any questions, please contact your workspace administrator.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending employee invitation email:", error);
      throw new Error("Failed to send employee invitation email");
    }

    return emailData;
  } catch (error) {
    console.error("Error in sendEmployeeInvitationEmail:", error);
    throw error;
  }
}
