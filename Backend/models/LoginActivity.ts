import mongoose, { Schema, Document } from 'mongoose';

export interface ILoginActivity extends Document {
  userId: mongoose.Types.ObjectId;
  ip?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  createdAt: Date;
}

const loginActivitySchema = new Schema<ILoginActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true, maxlength: 500 },
    success: { type: Boolean, required: true },
    failureReason: { type: String, trim: true },
  },
  { timestamps: true }
);

loginActivitySchema.index({ userId: 1, createdAt: -1 });

const LoginActivity = mongoose.model<ILoginActivity>('LoginActivity', loginActivitySchema);
export default LoginActivity;
