import mongoose, { Schema, Document } from 'mongoose';

/** One document per user; productIds array (referenced, moderate size) */
export interface IWishlist extends Document {
  userId: mongoose.Types.ObjectId;
  productIds: mongoose.Types.ObjectId[];
  updatedAt: Date;
}

const wishlistSchema = new Schema<IWishlist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    productIds: [
      { type: Schema.Types.ObjectId, ref: 'Product' },
    ],
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// userId index created by field options unique: true, index: true above
wishlistSchema.pre('save', function (this: IWishlist) {
  this.updatedAt = new Date();
});

const Wishlist = mongoose.model<IWishlist>('Wishlist', wishlistSchema);
export default Wishlist;
