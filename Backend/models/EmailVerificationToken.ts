import mongoose, { Schema, Document } from 'mongoose';

/**
 * Email Verification Token Interface
 */
export interface IEmailVerificationToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string; // Hashed token (never store raw token)
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const emailVerificationTokenSchema = new Schema<IEmailVerificationToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired tokens
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one active token per user
emailVerificationTokenSchema.index({ userId: 1, usedAt: 1 });

// Index for token lookup
emailVerificationTokenSchema.index({ tokenHash: 1, usedAt: 1 });

const EmailVerificationToken = mongoose.model<IEmailVerificationToken>(
  'EmailVerificationToken',
  emailVerificationTokenSchema
);

export default EmailVerificationToken;
