import mongoose, { Schema, Document } from 'mongoose';

/**
 * Registration/Authentication methods
 * User can only register using ONE of these methods
 */
export enum AuthMethod {
  EMAIL = 'email',      // Email + Password
  PHONE = 'phone',      // Phone + OTP verification
  GOOGLE = 'google',    // Google OAuth
}

/** Account status for customer profile (admin can suspend/unsuspend) */
export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

/** Address label for shipping */
export type AddressLabel = 'home' | 'office' | 'other';

/** Shipping address (embedded) */
export interface IShippingAddress {
  label: AddressLabel;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  deliveryInstructions?: string;
  isDefault: boolean;
}

/** Billing address (single embedded) */
export interface IBillingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** Stored payment method - token/reference only, NOT full card details */
export interface IPaymentMethod {
  paymentToken: string;   // Gateway token/reference
  brand?: string;        // e.g. visa, mastercard
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

/** Body measurements for size recommendations (inches, cm, kg) */
export interface IBodyMeasurements {
  chest?: number;             // inches
  waist?: number;             // inches
  hips?: number;              // inches
  height?: number;            // cm
  weight?: number;            // kg
  preferredShirtSize?: string;
  preferredPantsSize?: string;
}

/**
 * User interface
 * Enforces single registration method constraint
 */
export interface IUser extends Document {
  // ============================================
  // Registration Method (REQUIRED - One way only)
  // ============================================
  authMethod: AuthMethod;

  // ============================================
  // Email Method Fields (Required only if authMethod === 'email')
  // ============================================
  email?: string;              // Required for EMAIL method
  password?: string;          // Required for EMAIL method (hashed)
  isEmailVerified?: boolean;  // Email verification status
  emailVerifiedAt?: Date;    // Email verification timestamp

  // ============================================
  // Phone Method Fields (Required only if authMethod === 'phone')
  // Single source of truth: country code + rest (no duplicate full number).
  // ============================================
  phoneCountryCode?: string;  // Country code (e.g. '+1', '+92')
  phone?: string;            // Rest of number only, no country code (e.g. '3001234567'). Required for PHONE; optional for profile (email/google).
  isPhoneVerified?: boolean;  // OTP verification status
  otpCode?: string;           // Current OTP (hashed, temporary)
  otpExpiresAt?: Date;        // OTP expiration time
  otpAttempts?: number;       // Failed OTP attempts (for rate limiting)

  // ============================================
  // Google OAuth Fields (Required only if authMethod === 'google')
  // ============================================
  googleId?: string;          // Required for GOOGLE method (unique)
  googleEmail?: string;       // Email from Google account
  googleAvatar?: string;      // Profile picture URL from Google

  // ============================================
  // Common Fields (All methods)
  // ============================================
  name?: string;              // User's full name
  avatar?: string;            // Profile photo URL (custom or Google)
  isActive: boolean;          // Synced with accountStatus (active => true)
  lastLoginAt?: Date;         // Last login timestamp
  createdAt: Date;
  updatedAt: Date;

  // ============================================
  // Customer Profile (server-generated ID, status, addresses, payment)
  // ============================================
  customerId?: string;        // Server-generated, unique (e.g. CUS-XXXXXXXXXX); set on first save
  accountStatus: AccountStatus; // active | suspended | deleted
  deletedAt?: Date;           // Set when accountStatus is deleted
  shippingAddresses: IShippingAddress[];
  defaultShippingAddressIndex: number;
  billingAddress?: IBillingAddress;
  paymentMethods: IPaymentMethod[];
  bodyMeasurements?: IBodyMeasurements;
}

const userSchema = new Schema<IUser>(
  {
    // ============================================
    // Registration Method
    // ============================================
    authMethod: {
      type: String,
      enum: Object.values(AuthMethod),
      required: [true, 'Authentication method is required'],
      immutable: true, // Cannot be changed after registration
    },

    // ============================================
    // Email Method Fields
    // ============================================
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
      select: false, // Don't return password in queries by default
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

    // ============================================
    // Phone Method Fields (phone = rest only; phoneCountryCode = e.g. '+92')
    // ============================================
    phoneCountryCode: {
      type: String,
      trim: true,
      default: '+1',
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
      select: false, // Don't return OTP in queries by default
    },
    otpExpiresAt: {
      type: Date,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ============================================
    // Google OAuth Fields
    // ============================================
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

    // ============================================
    // Common Fields
    // ============================================
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

    // ============================================
    // Customer Profile
    // ============================================
    customerId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allow null for backward compat until migration
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
          state: { type: String, trim: true, default: '' },
          postalCode: { type: String, trim: true, default: '' },
          country: { type: String, trim: true, default: '' },
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
        state: { type: String, trim: true, default: '' },
        postalCode: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: '' },
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
  },
  {
    timestamps: true,
  }
);

// ============================================
// Indexes for Unique Constraints
// ============================================
// Email must be unique (when present)
userSchema.index({ email: 1 }, { unique: true, sparse: true });

// Phone number (countryCode + rest) must be unique when both present (no duplicate entries)
userSchema.index({ phoneCountryCode: 1, phone: 1 }, { unique: true, sparse: true });

// Google ID must be unique (when present)
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

// Compound index to ensure one registration method per user
userSchema.index({ authMethod: 1 });

// customerId index is created by field option unique: true, sparse: true above
userSchema.index({ accountStatus: 1 });

// ============================================
// Pre-save: generate customerId, sync accountStatus/isActive
// ============================================
userSchema.pre('save', async function (this: IUser) {
  const user = this;
  if (!user.accountStatus || !Object.values(AccountStatus).includes(user.accountStatus)) {
    user.accountStatus = AccountStatus.ACTIVE;
  }
  // Sync isActive with accountStatus
  user.isActive = user.accountStatus === AccountStatus.ACTIVE;
  if (user.accountStatus === AccountStatus.DELETED && !user.deletedAt) {
    user.deletedAt = new Date();
  }
  if (user.accountStatus !== AccountStatus.DELETED) {
    user.deletedAt = undefined;
  }
  // Generate customerId for new users (server-generated)
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

// ============================================
// Pre-save Validation Hook
// Efficiently enforces "one method only" constraint
// All validation happens here to avoid TypeScript issues
// ============================================
userSchema.pre('save', async function (this: IUser) {
  const user = this;

  // Validate authentication method
  if (!user.authMethod || !Object.values(AuthMethod).includes(user.authMethod)) {
    throw new Error('Invalid authentication method');
  }

  // Validate and clean based on authMethod
  if (user.authMethod === AuthMethod.EMAIL) {
    // Validate required fields for EMAIL method
    if (!user.email || typeof user.email !== 'string' || user.email.trim().length === 0) {
      throw new Error('Email is required for email authentication method');
    }
    // Only validate password if it's being modified (new document or password field changed)
    if (user.isNew || user.isModified('password')) {
      if (!user.password || typeof user.password !== 'string' || user.password.length < 6) {
        throw new Error('Password is required and must be at least 6 characters for email authentication method');
      }
    }
    // Clear other *auth* method fields only; keep optional profile phone (phoneCountryCode + phone) if set
    user.isPhoneVerified = undefined;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = undefined;
    user.googleId = undefined;
    user.googleEmail = undefined;
    user.googleAvatar = undefined;
  } else if (user.authMethod === AuthMethod.PHONE) {
    // Validate required fields for PHONE method
    if (!user.phone || typeof user.phone !== 'string' || user.phone.trim().length === 0) {
      throw new Error('Phone number (rest) is required for phone authentication method');
    }
    if (!user.phoneCountryCode || typeof user.phoneCountryCode !== 'string' || user.phoneCountryCode.trim().length === 0) {
      throw new Error('Phone country code is required for phone authentication method');
    }
    // Clear other *auth* method fields only; keep optional profile email (user.email) if set
    user.password = undefined;
    user.isEmailVerified = undefined;
    user.googleId = undefined;
    user.googleEmail = undefined;
    user.googleAvatar = undefined;
  } else if (user.authMethod === AuthMethod.GOOGLE) {
    // Validate required fields for GOOGLE method
    if (!user.googleId || typeof user.googleId !== 'string' || user.googleId.trim().length === 0) {
      throw new Error('Google ID is required for Google authentication method');
    }
    // Clear other *auth* method fields only; keep optional profile email and phone
    user.password = undefined;
    user.isEmailVerified = undefined;
    user.isPhoneVerified = undefined;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = undefined;
  }
});

// ============================================
// Instance Methods
// ============================================
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  // Never send password or OTP in JSON responses
  delete user.password;
  delete user.otpCode;
  return user;
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;
