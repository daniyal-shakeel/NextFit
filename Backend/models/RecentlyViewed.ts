import mongoose, { Schema, Document } from 'mongoose';

export interface IRecentlyViewedEntry {
  productId: mongoose.Types.ObjectId;
  viewedAt: Date;
}

export interface IRecentlyViewed extends Document {
  userId: mongoose.Types.ObjectId;
  entries: IRecentlyViewedEntry[];
  updatedAt: Date;
}

const entrySchema = new Schema<IRecentlyViewedEntry>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const recentlyViewedSchema = new Schema<IRecentlyViewed>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    entries: {
      type: [entrySchema],
      default: [],
      validate: [{ validator: (v: IRecentlyViewedEntry[]) => Array.isArray(v) && v.length <= 100, message: 'At most 100 recently viewed' }],
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

recentlyViewedSchema.pre('save', function (this: IRecentlyViewed) {
  this.updatedAt = new Date();
});

const RecentlyViewed = mongoose.model<IRecentlyViewed>('RecentlyViewed', recentlyViewedSchema);
export default RecentlyViewed;
