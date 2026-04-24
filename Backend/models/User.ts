import mongoose, { Schema, Document } from 'mongoose';

export enum AuthMethod {
  EMAIL = 'email',      
  PHONE = 'phone',      
  GOOGLE = 'google',    
}

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export type AddressLabel = 'home' | 'office' | 'other';

export interface IShippingAddress {
  label: AddressLabel;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  deliveryInstructions?: string;
  isDefault: boolean;
}

export interface IBillingAddress {
  street: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface IPaymentMethod {
  paymentToken: string;   
  brand?: string;        
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface IBodyMeasurements {
  chest?: number;             
  waist?: number;             
  hips?: number;              
  height?: number;            
  weight?: number;            
  preferredShirtSize?: string;
  preferredPantsSize?: string;
}

export interface IUser extends Document {

  authMethod: AuthMethod;

  email?: string;              
  password?: string;          
  isEmailVerified?: boolean;  
  emailVerifiedAt?: Date;    

  phoneCountryCode?: string;  
  phone?: string;            
  isPhoneVerified?: boolean;  
  otpCode?: string;           
  otpExpiresAt?: Date;        
  otpAttempts?: number;       

  googleId?: string;          
  googleEmail?: string;       
  googleAvatar?: string;      

  name?: string;              
  avatar?: string;            
  isActive: boolean;          
  lastLoginAt?: Date;         
  createdAt: Date;
  updatedAt: Date;
  customerId?: string;        
  accountStatus: AccountStatus; 
  deletedAt?: Date;           
  shippingAddresses: IShippingAddress[];
  defaultShippingAddressIndex: number;
  billingAddress?: IBillingAddress;
  paymentMethods: IPaymentMethod[];
  bodyMeasurements?: IBodyMeasurements;
  aiTryOnCount: number;
  lastAiTryOnAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    authMethod: {
      type: String,
      enum: Object.values(AuthMethod),
      required: [true, 'Authentication method is required'],
      immutable: true, 
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      required: function (this: IUser) {
        return this.authMethod === AuthMethod.EMAIL;
      },
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, 
      required: function (this: IUser) {
        return this.authMethod === AuthMethod.EMAIL;
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    phoneCountryCode: {
      type: String,
      trim: true,
      maxlength: [6, 'Country code cannot exceed 6 characters'],
    },
    phone: {
      type: String,
      trim: true,
      required: function (this: IUser) {
        return this.authMethod === AuthMethod.PHONE;
      },
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    otpCode: {
      type: String,
      select: false, 
    },
    otpExpiresAt: {
      type: Date,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    googleId: {
      type: String,
      required: function (this: IUser) {
        return this.authMethod === AuthMethod.GOOGLE;
      },
    },
    googleEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    googleAvatar: {
      type: String,
      trim: true,
    },

    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    avatar: {
      type: String,
      trim: true,
      maxlength: [2000, 'Avatar URL cannot exceed 2000 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },

    customerId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, 
    },
    accountStatus: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.ACTIVE,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    shippingAddresses: {
      type: [
        {
          label: { type: String, enum: ['home', 'office', 'other'], default: 'home' },
          street: { type: String, trim: true, default: '' },
          city: { type: String, trim: true, default: '' },
          province: { type: String, trim: true, default: '' },
          postalCode: { type: String, trim: true, default: '' },
          deliveryInstructions: { type: String, trim: true, default: '' },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
      validate: [
        { validator: (v: IShippingAddress[]) => Array.isArray(v) && v.length <= 20, message: 'At most 20 shipping addresses' },
      ],
    },
    defaultShippingAddressIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    billingAddress: {
      type: {
        street: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        province: { type: String, trim: true, default: '' },
        postalCode: { type: String, trim: true, default: '' },
      },
      default: null,
    },
    paymentMethods: {
      type: [
        {
          paymentToken: { type: String, required: true, trim: true },
          brand: { type: String, trim: true },
          last4: { type: String, trim: true, maxlength: 4 },
          expiryMonth: { type: Number, min: 1, max: 12 },
          expiryYear: { type: Number, min: 2000, max: 2100 },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
      validate: [
        { validator: (v: IPaymentMethod[]) => Array.isArray(v) && v.length <= 10, message: 'At most 10 payment methods' },
      ],
    },
    bodyMeasurements: {
      type: {
        chest: { type: Number, min: 0, max: 100 },
        waist: { type: Number, min: 0, max: 100 },
        hips: { type: Number, min: 0, max: 100 },
        height: { type: Number, min: 0, max: 300 },
        weight: { type: Number, min: 0, max: 500 },
        preferredShirtSize: { type: String, trim: true, maxlength: 20 },
        preferredPantsSize: { type: String, trim: true, maxlength: 20 },
      },
      default: undefined,
    },
    aiTryOnCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAiTryOnAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });

userSchema.index({ phoneCountryCode: 1, phone: 1 }, { unique: true, sparse: true });

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

userSchema.index({ authMethod: 1 });

userSchema.index({ accountStatus: 1 });

userSchema.pre('save', async function (this: IUser) {
  const user = this;
  if (!user.accountStatus || !Object.values(AccountStatus).includes(user.accountStatus)) {
    user.accountStatus = AccountStatus.ACTIVE;
  }
  user.isActive = user.accountStatus === AccountStatus.ACTIVE;
  if (user.accountStatus === AccountStatus.DELETED && !user.deletedAt) {
    user.deletedAt = new Date();
  }
  if (user.accountStatus !== AccountStatus.DELETED) {
    user.deletedAt = undefined;
  }
  if (!user.customerId || String(user.customerId).trim() === '') {
    const { generateCustomerId } = await import('../utils/customerId.js');
    let candidate: string;
    let attempts = 0;
    const maxAttempts = 5;
    do {
      candidate = generateCustomerId();
      const existing = await (user.constructor as mongoose.Model<IUser>).findOne({ customerId: candidate });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);
    if (attempts >= maxAttempts) throw new Error('Could not generate unique customer ID');
    user.customerId = candidate;
  }
});

userSchema.pre('save', async function (this: IUser) {
  const user = this;

  if (!user.authMethod || !Object.values(AuthMethod).includes(user.authMethod)) {
    throw new Error('Invalid authentication method');
  }

  if (user.authMethod === AuthMethod.EMAIL) {
    if (!user.email || typeof user.email !== 'string' || user.email.trim().length === 0) {
      throw new Error('Email is required for email authentication method');
    }
    if (user.isNew || user.isModified('password')) {
      if (!user.password || typeof user.password !== 'string' || user.password.length < 6) {
        throw new Error('Password is required and must be at least 6 characters for email authentication method');
      }
    }
    user.isPhoneVerified = undefined;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = undefined;
    user.googleId = undefined;
    user.googleEmail = undefined;
    user.googleAvatar = undefined;
    const hasProfilePhone =
      typeof user.phone === 'string' &&
      user.phone.trim().length > 0 &&
      typeof user.phoneCountryCode === 'string' &&
      user.phoneCountryCode.trim().length > 0;
    if (!hasProfilePhone) {
      user.set('phone', undefined);
      user.set('phoneCountryCode', undefined);
    }
  } else if (user.authMethod === AuthMethod.PHONE) {
    if (!user.phone || typeof user.phone !== 'string' || user.phone.trim().length === 0) {
      throw new Error('Phone number (rest) is required for phone authentication method');
    }
    if (!user.phoneCountryCode || typeof user.phoneCountryCode !== 'string' || user.phoneCountryCode.trim().length === 0) {
      throw new Error('Phone country code is required for phone authentication method');
    }
    user.password = undefined;
    user.isEmailVerified = undefined;
    user.googleId = undefined;
    user.googleEmail = undefined;
    user.googleAvatar = undefined;
  } else if (user.authMethod === AuthMethod.GOOGLE) {
    if (!user.googleId || typeof user.googleId !== 'string' || user.googleId.trim().length === 0) {
      throw new Error('Google ID is required for Google authentication method');
    }
    user.password = undefined;
    user.isEmailVerified = undefined;
    user.isPhoneVerified = undefined;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = undefined;
    const hasProfilePhoneGoogle =
      typeof user.phone === 'string' &&
      user.phone.trim().length > 0 &&
      typeof user.phoneCountryCode === 'string' &&
      user.phoneCountryCode.trim().length > 0;
    if (!hasProfilePhoneGoogle) {
      user.set('phone', undefined);
      user.set('phoneCountryCode', undefined);
    }
  }
});

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.otpCode;
  return user;
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;
