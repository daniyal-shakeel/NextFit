/**
 * Email templates for various email types
 */

interface EmailVerificationData {
  name: string;
  verificationUrl: string;
}

/**
 * Generate email verification email HTML template
 */
export const getVerificationEmailTemplate = (data: EmailVerificationData): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - NextFit</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">NextFit</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
    <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
    
    <p>Hi ${data.name},</p>
    
    <p>Thank you for signing up for NextFit! Please verify your email address by clicking the button below:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.verificationUrl}" 
         style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Verify Email Address
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #667eea; font-size: 12px; word-break: break-all;">${data.verificationUrl}</p>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      This link will expire in 24 hours. If you didn't create an account, please ignore this email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; margin: 0;">
      © ${new Date().getFullYear()} NextFit. All rights reserved.
    </p>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generate plain text version of verification email
 */
export const getVerificationEmailText = (data: EmailVerificationData): string => {
  return `
Hi ${data.name},

Thank you for signing up for NextFit! Please verify your email address by visiting the following link:

${data.verificationUrl}

This link will expire in 24 hours. If you didn't create an account, please ignore this email.

© ${new Date().getFullYear()} NextFit. All rights reserved.
  `.trim();
};
