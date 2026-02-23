import mongoose, { Schema, Document } from 'mongoose';

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 999;
const MAX_ITEMS = 100;
const MAX_SIZE_LENGTH = 50;
const MAX_COLOR_LENGTH = 50;

export interface ICartItem {
  _id?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  size?: string;
  color?: string;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: ICartItem[];
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: {
      type: Number,
      required: true,
      min: [MIN_QUANTITY, `Quantity must be at least ${MIN_QUANTITY}`],
      max: [MAX_QUANTITY, `Quantity cannot exceed ${MAX_QUANTITY}`],
    },
    size: {
      type: String,
      trim: true,
      maxlength: [MAX_SIZE_LENGTH, `Size cannot exceed ${MAX_SIZE_LENGTH} characters`],
      default: undefined,
    },
    color: {
      type: String,
      trim: true,
      maxlength: [MAX_COLOR_LENGTH, `Color cannot exceed ${MAX_COLOR_LENGTH} characters`],
      default: undefined,
    },
  },
  { _id: true }
);

const cartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: {
      type: [cartItemSchema],
      default: [],
      validate: [
        {
          validator: (v: ICartItem[]) => Array.isArray(v) && v.length <= MAX_ITEMS,
          message: `Cart cannot exceed ${MAX_ITEMS} items`,
        },
      ],
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

cartSchema.pre('save', function (this: ICart) {
  this.updatedAt = new Date();
});

const Cart = mongoose.model<ICart>('Cart', cartSchema);
export default Cart;
export { MIN_QUANTITY, MAX_QUANTITY, MAX_ITEMS };
