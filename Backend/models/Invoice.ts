import mongoose, { Schema, Document } from 'mongoose';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled' | 'refunded';

export interface IInvoice extends Document {
  invoiceNumber: string; // Human-readable, unique
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  transactionId?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'PKR', trim: true },
    status: {
      type: String,
      enum: ['draft', 'issued', 'paid', 'cancelled', 'refunded'],
      default: 'issued',
      index: true,
    },
    transactionId: { type: String, trim: true },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

invoiceSchema.index({ userId: 1, createdAt: -1 });

const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
export default Invoice;
