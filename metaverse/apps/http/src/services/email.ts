import nodemailer from "nodemailer";

export async function Email_service(email: string, email_password: string , to:string , otp:string) {
  // Create a transporter object
  const transporter = nodemailer.createTransport({
    service: "gmail", // or use custom SMTP config
    auth: {
      user: email,
      pass: email_password,
    },
  });

  // Function to send OTP email
  return async function sendOTPEmail() {
    const subject = "MetaSpace Password Reset OTP";
    const text = `Your MetaSpace OTP is: ${otp}`;

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f6f7fb;">
        <div style="max-width: 500px; margin: auto; background: white; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background: linear-gradient(135deg, #3b82f6, #9333ea); color: white; text-align: center; padding: 15px 0;">
            <h2>🌌 MetaSpace</h2>
          </div>
          <div style="padding: 25px;">
            <h3 style="color: #111827;">Forgot Your Password?</h3>
            <p style="color: #374151;">No worries! Use the OTP below to reset your MetaSpace account password:</p>
            <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #6b7280;">This OTP will expire in <b>10 minutes</b>. Please do not share it with anyone.</p>
            <p style="margin-top: 25px; color: #9ca3af;">— The MetaSpace Security Team</p>
          </div>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"MetaSpace Support" <${email}>`,
        to,
        subject,
        text,
        html,
      });

      console.log("OTP Email sent:", info.messageId);
      return info;
    } catch (error) {
      console.error("Error sending OTP email:", error);
      throw error;
    }
  };
}
