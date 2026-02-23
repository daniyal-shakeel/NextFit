/**
 * Environment variable validation and parsing
 */

interface EmailConfig {
  provider: 'smtp' | 'api';
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
  };
  from: string;
  appBaseUrl: string;
}

/**
 * Get and validate email configuration from environment variables
 */
export const getEmailConfig = (): EmailConfig => {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp') as 'smtp' | 'api';
  const nodeEnv = process.env.NODE_ENV || 'development';

  // SMTP Configuration
  const smtpHost = process.env.SMTP_HOST || (nodeEnv === 'development' ? 'localhost' : '');
  const smtpPort = parseInt(process.env.SMTP_PORT || '1025', 10);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  // Email settings
  const emailFrom = process.env.EMAIL_FROM || 'noreply@nextfit.com';
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:8080';

  // Validation
  if (provider === 'smtp' && !smtpHost) {
    throw new Error('SMTP_HOST is required when EMAIL_PROVIDER is smtp');
  }

  return {
    provider,
    smtp: {
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass: smtpPass,
      secure: smtpSecure,
    },
    from: emailFrom,
    appBaseUrl,
  };
};
