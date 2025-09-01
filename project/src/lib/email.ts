import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(data: EmailData) {
  try {
    const { data: emailData, error } = await resend.emails.send({
      from: "PSS_Support@psswwe.com", // Update this with your verified domain
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text || data.html.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
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
      from: "PSS_Support@psswwe.com", // Update this with your verified domain
      to: "psswwe@gmail.com",
      subject: "New User Registration Requires Approval",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New User Registration</h2>
          <p>A new user has registered and requires your approval:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">User Details:</h3>
            <p><strong>Name:</strong> ${data.userName}</p>
            <p><strong>Email:</strong> ${data.userEmail}</p>
            <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.approvalUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review & Approve User
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Click the button above to review and approve this user registration.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending email:", error);
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
      from: "PSS_Support@psswwe.com", // Update this with your verified domain
      to: userEmail,
      subject: "Your Account Has Been Approved!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Account Approved!</h2>
          <p>Hello ${userName},</p>
          
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
      from: "PSS_Support@psswwe.com", // Update this with your verified domain
      to: userEmail,
      subject: "Verify Your Email - Signup",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Our Platform!</h2>
          <p>Hi ${userName},</p>
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
      from: "PSS_Support@psswwe.com", // Update this with your verified domain
      to: userEmail,
      subject: "2FA Verification Code - Shipment Deletion",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Shipment Deletion Verification</h2>
          <p>Hi ${userName},</p>
          <p>You have requested to delete a shipment. To complete this action, please use the verification code below:</p>
          
          <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #721c24; font-size: 32px; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
          </div>
          
          <p><strong>This code will expire in 10 minutes.</strong></p>
          
          <p style="color: #721c24; font-weight: bold;">⚠️ Warning: This action will permanently delete the shipment and all related data. This cannot be undone.</p>
          
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
