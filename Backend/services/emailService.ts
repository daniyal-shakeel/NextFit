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
    });
  }

  throw new Error(`Email provider "${config.provider}" is not yet implemented`);
};

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
