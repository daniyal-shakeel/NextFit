import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  categoryId: mongoose.Types.ObjectId;
  basePrice: number;
  mainImageUrl: string;
  imageUrls: string[];
  features: string[];
  rating: number;
  reviewCount: number;
  isCustomizable: boolean;
  tags: string[]; 
  stockQuantity: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: [250, 'Slug cannot exceed 250 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Price cannot be negative'],
    },
    mainImageUrl: {
      type: String,
      required: [true, 'Main image URL is required'],
      trim: true,
    },
    imageUrls: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length === 3,
        message: 'Exactly 3 secondary image URLs are required',
      },
    },
    features: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => Array.isArray(v),
        message: 'features must be an array of strings',
      },
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, 'Review count cannot be negative'],
    },
    isCustomizable: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => Array.isArray(v),
        message: 'tags must be an array of strings',
      },
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    lowStockThreshold: {
      type: Number,
      default: 0,
      min: [0, 'Low stock threshold cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ categoryId: 1, createdAt: -1 });
productSchema.index({ tags: 1 });
productSchema.index({ basePrice: 1 });

const Product = mongoose.model<IProduct>('Product', productSchema);

export default Product;
