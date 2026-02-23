import mongoose, { Schema, Document } from 'mongoose';

/**
 * Category document interface
 */
export interface ICategory extends Document {
  name: string;
  slug: string;
  imageUrl: string;
  description?: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: [120, 'Slug cannot exceed 120 characters'],
    },
    imageUrl: {
      type: String,
      required: [true, 'Category image URL is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    productCount: {
      type: Number,
      default: 0,
      min: [0, 'Product count cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// slug index created by field option unique: true above

const Category = mongoose.model<ICategory>('Category', categorySchema);

export default Category;
