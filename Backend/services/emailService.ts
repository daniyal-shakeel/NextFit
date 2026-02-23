/**
 * Email Service - Switchable between Docker SMTP (dev) and production SMTP/API
 */

import nodemailer from 'nodemailer';
import { getEmailConfig } from '../utils/env.js';
import { getVerificationEmailTemplate, getVerificationEmailText } from '../utils/emailTemplates.js';

interface SendVerificationEmailParams {
  to: string;
  name: string;
  verificationUrl: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Create email transporter based on environment configuration
 */
const createTransporter = () => {
  const config = getEmailConfig();

  if (config.provider === 'smtp') {
    return nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user && config.smtp.pass ? {
        user: config.smtp.user,
        pass: config.smtp.pass,
      } : undefined,
      // For Docker SMTP servers (MailHog/Mailpit), no auth is needed
      // For production SMTP, auth will be provided via env vars
    });
  }

  // Future: Add API-based email providers (SendGrid, Mailgun, etc.)
  // For now, default to SMTP
  throw new Error(`Email provider "${config.provider}" is not yet implemented`);
};

/**
 * Send email verification email
 */
export const sendVerificationEmail = async (
  params: SendVerificationEmailParams
): Promise<SendEmailResult> => {
  try {
    const config = getEmailConfig();
    const transporter = createTransporter();

    const mailOptions = {
      from: config.from,
      to: params.to,
      subject: 'Verify Your Email - NextFit',
      text: getVerificationEmailText({
        name: params.name,
        verificationUrl: params.verificationUrl,
      }),
      html: getVerificationEmailTemplate({
        name: params.name,
        verificationUrl: params.verificationUrl,
      }),
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
};

/**
 * Verify email transporter connection (useful for health checks)
 */
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email connection verification failed:', error);
    return false;
  }
};
