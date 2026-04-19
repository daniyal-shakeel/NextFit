import mongoose, { Schema, Document } from 'mongoose';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export interface IOrderLineItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  priceAtOrder: number;
  subtotal: number;
}

export interface IOrder extends Document {
  orderNumber: string;
  userId?: mongoose.Types.ObjectId;
  status: OrderStatus;
  lineItems: IOrderLineItem[];
  subtotal: number;
  discountAmount: number;
  discountCode?: string;
  total: number;
  currency: string;
  shippingAddress?: mongoose.Types.ObjectId | Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  transactionIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const orderLineItemSchema = new Schema<IOrderLineItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    priceAtOrder: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'partially_refunded'],
      default: 'pending',
      index: true,
    },
    lineItems: {
      type: [orderLineItemSchema],
      default: [],
      validate: [{ validator: (v: IOrderLineItem[]) => Array.isArray(v) && v.length > 0, message: 'At least one line item required' }],
    },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    discountCode: { type: String, trim: true },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'PKR', trim: true },
    shippingAddress: { type: Schema.Types.Mixed },
    billingAddress: { type: Schema.Types.Mixed },
    transactionIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1, createdAt: -1 });

orderSchema.pre('save', async function (this: IOrder) {
  const order = this;
  if (!order.orderNumber || String(order.orderNumber).trim() === '') {
    const { generateOrderNumber } = await import('../utils/orderNumber.js');
    let candidate: string;
    let attempts = 0;
    const maxAttempts = 5;
    do {
      candidate = generateOrderNumber();
      const existing = await (order.constructor as mongoose.Model<IOrder>).findOne({ orderNumber: candidate });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);
    if (attempts >= maxAttempts) throw new Error('Could not generate unique order number');
    order.orderNumber = candidate;
  }
});

const Order = mongoose.model<IOrder>('Order', orderSchema);
export default Order;
