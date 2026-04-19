import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminSettings extends Document {
  defaultStockQuantity: number;
  defaultLowStockThreshold: number;
  shippingRate: number;
  freeShippingMinSubtotal: number;
  aiDescriptionSuggestionsEnabled: boolean;
  aiTagSuggestionsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const adminSettingsSchema = new Schema<IAdminSettings>(
  {
    defaultStockQuantity: {
      type: Number,
      default: 0,
      min: 0,
      max: 1_000_000,
    },
    defaultLowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
      max: 1_000_000,
    },
    shippingRate: {
      type: Number,
      default: 10,
      min: 0,
      max: 1_000_000,
    },
    freeShippingMinSubtotal: {
      type: Number,
      default: 100,
      min: 0,
      max: 1_000_000_000,
    },
    aiDescriptionSuggestionsEnabled: {
      type: Boolean,
      default: true,
    },
    aiTagSuggestionsEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IAdminSettings>('AdminSettings', adminSettingsSchema);
