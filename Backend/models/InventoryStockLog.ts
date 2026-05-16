import mongoose, { Schema, Document } from 'mongoose';

export type StockChangeType = 'manual' | 'order';

export interface IInventoryStockLog extends Document {
  productId: mongoose.Types.ObjectId;
  previousStock: number;
  newStock: number;
  quantityChange: number;
  changeType: StockChangeType;
  reason: string;
  orderId?: mongoose.Types.ObjectId;
  previousThreshold: number;
  newThreshold: number;
  changedByEmail?: string;
  changedById?: string;
  createdAt: Date;
}

const inventoryStockLogSchema = new Schema<IInventoryStockLog>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    quantityChange: { type: Number, required: true },
    changeType: { type: String, enum: ['manual', 'order'], required: true },
    reason: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    previousThreshold: { type: Number, required: true, min: 0 },
    newThreshold: { type: Number, required: true, min: 0 },
    changedByEmail: { type: String, trim: true },
    changedById: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inventoryStockLogSchema.index({ createdAt: -1 });
inventoryStockLogSchema.index({ productId: 1, createdAt: -1 });

const InventoryStockLog = mongoose.model<IInventoryStockLog>(
  'InventoryStockLog',
  inventoryStockLogSchema
);

export default InventoryStockLog;
