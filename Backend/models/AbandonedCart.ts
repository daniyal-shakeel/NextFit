import mongoose, { Schema, Document } from 'mongoose';

/** Snapshot of cart when user abandons (e.g. not logged in or left checkout). */
export interface IAbandonedCartItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  priceAtAbandon?: number;
}

export interface IAbandonedCart extends Document {
  userId?: mongoose.Types.ObjectId; // Optional for guest
  sessionId?: string; // For guest identification
  items: IAbandonedCartItem[];
  abandonedAt: Date;
  createdAt: Date;
}

const abandonedItemSchema = new Schema<IAbandonedCartItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceAtAbandon: { type: Number, min: 0 },
  },
  { _id: false }
);

const abandonedCartSchema = new Schema<IAbandonedCart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, trim: true, index: true },
    items: { type: [abandonedItemSchema], default: [] },
    abandonedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

abandonedCartSchema.index({ userId: 1, abandonedAt: -1 });

const AbandonedCart = mongoose.model<IAbandonedCart>('AbandonedCart', abandonedCartSchema);
export default AbandonedCart;
