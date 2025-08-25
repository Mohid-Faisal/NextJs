import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
