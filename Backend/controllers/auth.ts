import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import User, { AuthMethod } from '../models/User.js';
import EmailVerificationToken from '../models/EmailVerificationToken.js';
import { validateEmail, validateString, validatePhone, validatePakistanPhone, splitE164 } from '../utils/validation.js';
import { getFirebaseAdmin } from '../config/firebaseAdmin.js';
import { getDummyVerifiedPhone, isDummyPhoneVerificationEnabled } from '../utils/dummyPhoneVerification.js';
import { MONGODB_ERROR_CODES, MONGODB_ERROR_NAMES, HTTP_STATUS } from '../constants/errorCodes.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { generateTokenWithExpiry } from '../utils/generateToken.js';
import { hashToken } from '../utils/hashToken.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { recordLoginActivity } from '../services/loginActivity.js';
import { getEmailConfig } from '../utils/env.js';
import type { AuthPayload } from '../middleware/requirePermission.js';

interface RegisterRequestBody {
  authMethod?: string;
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
  phoneCountryCode?: string;
  otpCode?: string;
  googleId?: string;
  googleEmail?: string;
  googleAvatar?: string;
}

const register = async (req: Request, res: Response): Promise<Response> => {
  try {
    // ============================================
    // Edge Case 1: Missing request body
    // ============================================
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { authMethod, email, password, name, phone, phoneCountryCode, otpCode, googleId, googleEmail, googleAvatar }: RegisterRequestBody = req.body;

    // ============================================
    // Validate authMethod
    // ============================================
    if (!authMethod) {
      return res.status(400).json({
        success: false,
        message: 'Authentication method is required',
      });
    }

    if (!Object.values(AuthMethod).includes(authMethod as AuthMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid authentication method. Must be: email, phone, or google',
      });
    }

    // ============================================
    // AUTHENTICATION METHOD: EMAIL
    // Name, email and password only executes if authMethod is email
    // ============================================
    if (authMethod === AuthMethod.EMAIL) {
      // Validate email
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required',
        });
      }

      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: emailValidation.error || 'Invalid email',
        });
      }

      // Validate password
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required',
        });
      }

      if (typeof password !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Password must be a string',
        });
      }

      const trimmedPassword = password.trim();
      if (trimmedPassword.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Password cannot be empty',
        });
      }

      if (trimmedPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
      }

      if (trimmedPassword.length > 128) {
        return res.status(400).json({
          success: false,
          message: 'Password is too long (max 128 characters)',
        });
      }

      // Password strength validation
      const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
      if (!passwordStrengthRegex.test(trimmedPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        });
      }

      // Validate name (optional)
      let validatedName: string | undefined;
      if (name !== undefined && name !== null) {
        if (typeof name !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'Name must be a string',
          });
        }

        const nameValidation = validateString(name, {
          minLength: 2,
          maxLength: 50,
          trim: true,
          pattern: /^[a-zA-Z\s'-]+$/,
        });

        if (!nameValidation.isValid) {
          return res.status(400).json({
            success: false,
            message: nameValidation.error || 'Invalid name format',
          });
        }

        validatedName = name.trim();
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Block signup if this identity already exists with a different auth method (check both email and googleEmail)
      const existingUserByEmail = await User.findOne({
        $or: [{ email: normalizedEmail }, { googleEmail: normalizedEmail }],
      });
      if (existingUserByEmail) {
        if (existingUserByEmail.authMethod === AuthMethod.PHONE) {
          return res.status(409).json({
            success: false,
            message: 'Account already exists. Try again with phone number.',
          });
        }
        if (existingUserByEmail.authMethod === AuthMethod.GOOGLE) {
          return res.status(409).json({
            success: false,
            message: 'Account already exists. Try again with Google.',
          });
        }
        // authMethod === EMAIL: continue to existing flow below
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        authMethod: AuthMethod.EMAIL,
      });

      // If user exists and email is verified, prevent re-signup
      if (existingUser && existingUser.isEmailVerified) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists. Please login instead.',
        });
      }

      // Hash password
      let hashedPassword: string;
      try {
        const saltRounds = 12;
        hashedPassword = await bcrypt.hash(trimmedPassword, saltRounds);
      } catch (hashError) {
        console.error('Password hashing error:', hashError);
        return res.status(500).json({
          success: false,
          message: 'Error processing password. Please try again.',
        });
      }

      let newUser;
      
      // If user exists but email is NOT verified, update existing user
      if (existingUser && !existingUser.isEmailVerified) {
        try {
          // Update existing user with new password and name
          existingUser.password = hashedPassword;
          if (validatedName) {
            existingUser.name = validatedName;
          }
          existingUser.isEmailVerified = false; // Ensure it's still false
          existingUser.emailVerifiedAt = undefined; // Clear any previous verification timestamp
          await existingUser.save();
          newUser = existingUser;

          // Invalidate all old verification tokens for this user
          await EmailVerificationToken.updateMany(
            { userId: existingUser._id },
            { usedAt: new Date() }
          );
        } catch (updateError: any) {
          console.error('Error updating existing user:', updateError);
          return res.status(500).json({
            success: false,
            message: 'Error updating account. Please try again.',
          });
        }
      } else {
        // Create new user with isEmailVerified = false
        try {
          newUser = await User.create({
            authMethod: AuthMethod.EMAIL,
            email: normalizedEmail,
            password: hashedPassword,
            name: validatedName,
            isEmailVerified: false,
          });
        } catch (dbError: any) {
          if (dbError.code === MONGODB_ERROR_CODES.DUPLICATE_KEY || dbError.name === MONGODB_ERROR_NAMES.MONGO_SERVER_ERROR) {
            return res.status(HTTP_STATUS.CONFLICT).json({
              success: false,
              message: 'User with this email already exists',
            });
          }

          if (dbError.name === MONGODB_ERROR_NAMES.VALIDATION_ERROR) {
            const validationErrors = Object.values(dbError.errors).map(
              (err: any) => err.message
            );
            return res.status(400).json({
              success: false,
              message: 'Validation error',
              errors: validationErrors,
            });
          }

          console.error('Database error:', dbError);
          return res.status(500).json({
            success: false,
            message: 'Error creating user. Please try again.',
          });
        }
      }

      // Generate verification token
      const { token, expiresAt } = generateTokenWithExpiry(24); // 24 hours expiry
      const tokenHash = hashToken(token);

      // Save token to database
      try {
        await EmailVerificationToken.create({
          userId: newUser._id,
          tokenHash,
          expiresAt,
        });
      } catch (tokenError) {
        console.error('Error creating verification token:', tokenError);
        // User is created but token creation failed - still return success but note email may not be sent
        return res.status(201).json({
          success: true,
          message: 'Account created, but verification email could not be sent. Please contact support.',
          data: {
            id: newUser._id,
            email: newUser.email,
            name: newUser.name,
            requiresVerification: true,
          },
        });
      }

      // Send verification email
      const config = getEmailConfig();
      const verificationUrl = `${config.appBaseUrl}/verify-email?token=${token}`;
      
      const emailResult = await sendVerificationEmail({
        to: normalizedEmail,
        name: validatedName || 'User',
        verificationUrl,
      });

      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        // User and token are created, but email failed - still return success
        return res.status(201).json({
          success: true,
          message: 'Account created, but verification email could not be sent. Please use resend verification.',
          data: {
            id: newUser._id,
            email: newUser.email,
            name: newUser.name,
            requiresVerification: true,
          },
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Account created successfully. Please check your email to verify your account.',
        data: {
          id: newUser._id,
          email: newUser.email,
          name: newUser.name,
          requiresVerification: true,
        },
      });
    }

    // ============================================
    // AUTHENTICATION METHOD: PHONE
    // Phone steps only checked if authMethod is phone
    // ============================================
    if (authMethod === AuthMethod.PHONE) {
      /*
       * PSEUDO CODE FOR PHONE/OTP VERIFICATION:
       * 
       * Step 1: Validate phone number
       *   - Check if phone is provided
       *   - Validate phone format using validatePhone()
       *   - Check if phoneCountryCode is provided (default: '+1')
       *   - Normalize phone number format
       * 
       * Step 2: Check if user already exists
       *   - Query User.findOne({ phone: normalizedPhone })
       *   - If exists, return error: "User with this phone already exists"
       * 
       * Step 3: Generate OTP code
       *   - Generate random 6-digit OTP code
       *   - Hash OTP using bcrypt (for security)
       *   - Set expiration time (e.g., 10 minutes from now)
       *   - Store hashed OTP in user.otpCode
       *   - Store expiration in user.otpExpiresAt
       *   - Initialize otpAttempts to 0
       * 
       * Step 4: Send OTP via SMS
       *   - Use SMS service (Twilio, AWS SNS, etc.)
       *   - Send OTP to phone number
       *   - Handle SMS sending errors
       * 
       * Step 5: Create temporary user record
       *   - Create user with:
       *     - authMethod: AuthMethod.PHONE
       *     - phone: normalizedPhone
       *     - phoneCountryCode: phoneCountryCode || '+1'
       *     - isPhoneVerified: false
       *     - otpCode: hashedOTP
       *     - otpExpiresAt: expirationDate
       *     - otpAttempts: 0
       * 
       * Step 6: Return response
       *   - Return success with message: "OTP sent to phone number"
       *   - Do NOT return OTP code in response
       *   - Client should then call verify-otp endpoint
       * 
       * Step 7: OTP Verification (separate endpoint)
       *   - Receive phone and otpCode from client
       *   - Find user by phone
       *   - Check if OTP exists and not expired
       *   - Check otpAttempts < maxAttempts (e.g., 5)
       *   - Compare provided OTP with hashed OTP
       *   - If valid:
       *     - Set isPhoneVerified: true
       *     - Clear otpCode, otpExpiresAt
       *     - Reset otpAttempts
       *     - Return success with user data
       *   - If invalid:
       *     - Increment otpAttempts
       *     - Return error
       */

      return res.status(501).json({
        success: false,
        message: 'Phone/OTP registration not yet implemented',
      });
    }

    // ============================================
    // AUTHENTICATION METHOD: GOOGLE
    // Google steps only checks and executes if authMethod is google
    // ============================================
    if (authMethod === AuthMethod.GOOGLE) {
      /*
       * PSEUDO CODE FOR GOOGLE OAUTH:
       * 
       * Step 1: Validate Google OAuth data
       *   - Check if googleId is provided
       *   - Check if googleEmail is provided (optional but recommended)
       *   - Validate googleEmail format if provided
       * 
       * Step 2: Verify Google OAuth token
       *   - Receive Google ID token from client
       *   - Verify token with Google OAuth API
       *   - Extract user info from verified token:
       *     - googleId (sub claim)
       *     - googleEmail (email claim)
       *     - googleAvatar (picture claim)
       *     - name (name claim)
       * 
       * Step 3: Check if user already exists
       *   - Query User.findOne({ googleId: googleId })
       *   - If exists:
       *     - Update lastLoginAt
       *     - Return existing user data
       *   - If not exists, continue to Step 4
       * 
       * Step 4: Check if email already registered with different method
       *   - If googleEmail provided:
       *     - Query User.findOne({ email: googleEmail })
       *     - If exists with different authMethod:
       *       - Return error: "Email already registered with different method"
       * 
       * Step 5: Create new user
       *   - Create user with:
       *     - authMethod: AuthMethod.GOOGLE
       *     - googleId: verifiedGoogleId
       *     - googleEmail: verifiedGoogleEmail
       *     - googleAvatar: verifiedGoogleAvatar
       *     - name: verifiedName (from Google profile)
       *     - isActive: true
       *     - lastLoginAt: currentDate
       * 
       * Step 6: Generate JWT token
       *   - Create JWT token with user ID
       *   - Set token expiration (e.g., 7 days)
       *   - Sign token with secret key
       * 
       * Step 7: Return response
       *   - Return success with:
       *     - user data (id, name, email, avatar)
     *     - JWT token
       *     - message: "Registered successfully with Google"
       */

      return res.status(501).json({
        success: false,
        message: 'Google OAuth registration not yet implemented',
      });
    }

    // Should never reach here, but handle unknown authMethod
    return res.status(400).json({
      success: false,
      message: 'Invalid authentication method',
    });
  } catch (error: any) {
    console.error('Unexpected error in register controller:', error);

    if (error.name === MONGODB_ERROR_NAMES.CAST_ERROR) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid data format',
      });
    }

    if (error.name === MONGODB_ERROR_NAMES.MONGOOSE_ERROR || error.name === MONGODB_ERROR_NAMES.MONGO_SERVER_ERROR) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Database error. Please try again later.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    });
  }
};

/**
 * Verify email with token
 * GET /api/auth/verify-email?token=...
 */
const verifyEmail = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
    }

    // Hash the provided token
    const tokenHash = hashToken(token);

    // Find token in database
    const verificationToken = await EmailVerificationToken.findOne({
      tokenHash,
      usedAt: null, // Not used yet
    }).populate('userId');

    if (!verificationToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    // Check if token is expired
    if (new Date() > verificationToken.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired. Please request a new one.',
      });
    }

    // Check if token is already used
    if (verificationToken.usedAt) {
      return res.status(400).json({
        success: false,
        message: 'This verification token has already been used',
      });
    }

    // Get user
    const user = await User.findById(verificationToken.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is already verified
    if (user.isEmailVerified) {
      // Mark token as used anyway
      verificationToken.usedAt = new Date();
      await verificationToken.save();

      return res.status(200).json({
        success: true,
        message: 'Email is already verified. Please sign in.',
      });
    }

    // Verify user email
    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    // Mark token as used
    verificationToken.usedAt = new Date();
    await verificationToken.save();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. Please sign in.',
    });
  } catch (error: any) {
    console.error('Error verifying email:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying email. Please try again.',
    });
  }
};

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 */
const resendVerification = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Find user
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail, authMethod: AuthMethod.EMAIL });

    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a verification email has been sent.',
      });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    // Invalidate old tokens for this user
    await EmailVerificationToken.updateMany(
      { userId: user._id, usedAt: null },
      { usedAt: new Date() }
    );

    // Generate new token
    const { token, expiresAt } = generateTokenWithExpiry(24);
    const tokenHash = hashToken(token);

    // Save new token
    try {
      await EmailVerificationToken.create({
        userId: user._id,
        tokenHash,
        expiresAt,
      });
    } catch (tokenError) {
      console.error('Error creating verification token:', tokenError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate verification token. Please try again.',
      });
    }

    // Send verification email
    const config = getEmailConfig();
    const verificationUrl = `${config.appBaseUrl}/verify-email?token=${token}`;

    const emailResult = await sendVerificationEmail({
      to: normalizedEmail,
      name: user.name || 'User',
      verificationUrl,
    });

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification email sent successfully. Please check your inbox.',
    });
  } catch (error: any) {
    console.error('Error resending verification email:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again.',
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { email, password } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.error || 'Invalid email format',
      });
    }

    // Validate password
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    if (typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password must be a string',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      email: normalizedEmail,
      authMethod: AuthMethod.EMAIL,
    }).select('+password');

    if (!user) {
      const existingByEmail = await User.findOne({
        $or: [{ email: normalizedEmail }, { googleEmail: normalizedEmail }],
      });
      if (existingByEmail) {
        if (existingByEmail.authMethod === AuthMethod.PHONE) {
          return res.status(409).json({
            success: false,
            message: 'Account already exists. Try again with phone number.',
          });
        }
        if (existingByEmail.authMethod === AuthMethod.GOOGLE) {
          return res.status(409).json({
            success: false,
            message: 'Account already exists. Try again with Google.',
          });
        }
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        requiresVerification: true,
        email: user.email,
      });
    }

    // Verify password
    if (!user.password) {
      return res.status(500).json({
        success: false,
        message: 'Account error. Please contact support.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await recordLoginActivity(user._id.toString(), false, req, 'Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();
    await recordLoginActivity(user._id.toString(), true, req);

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string') {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error. Please contact support.',
      });
    }

    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      authMethod: user.authMethod,
    };

    // Token expiration: 7 days
    const tokenExpiration = process.env.JWT_EXPIRATION || '7d';
    const token = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: tokenExpiration,
    } as SignOptions);

    // Get cookie configuration based on environment
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    
    // Cookie settings
    const cookieOptions = {
      httpOnly: true, // Prevent XSS attacks
      secure: isProduction, // Only send over HTTPS in production
      sameSite: isProduction ? ('strict' as const) : ('lax' as const), // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: '/', // Available site-wide
    };

    // Set token in cookie
    res.cookie('authToken', token, cookieOptions);

    // Return success
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          authMethod: user.authMethod,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in login controller:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login. Please try again.',
    });
  }
};

/**
 * Admin login: authenticates against ADMIN_EMAIL and ADMIN_PASSWORD from .env only.
 * Separate from user login: even if a user exists with the same email/password,
 * they get a user token (no permissions) when using POST /api/auth/login.
 * Only this endpoint issues a token with admin permissions.
 * POST /api/auth/admin/login
 */
const adminLogin = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.error || 'Invalid email format',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('ADMIN_EMAIL or ADMIN_PASSWORD is not set in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedAdminEmail = adminEmail.toLowerCase().trim();

    if (normalizedEmail !== normalizedAdminEmail || password !== adminPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string') {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error.',
      });
    }

    const tokenPayload: AuthPayload = {
      id: 'admin',
      email: normalizedAdminEmail,
      authMethod: 'admin',
      permissions: Object.values(PERMISSIONS),
    };

    const tokenExpiration = process.env.JWT_EXPIRATION || '7d';
    const token = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: tokenExpiration,
    } as SignOptions);

    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };

    res.cookie('adminAuthToken', token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: {
          id: 'admin',
          email: normalizedAdminEmail,
          authMethod: 'admin',
          isAdmin: true,
          permissions: tokenPayload.permissions,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in adminLogin controller:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during admin login. Please try again.',
    });
  }
};

/**
 * Check authentication status for regular users (Frontend).
 * GET /api/auth/check-auth
 * Only accepts authToken cookie (or Bearer). Ignores adminAuthToken so there is no
 * ambiguity: if authToken is removed, user is not authenticated even if adminAuthToken exists.
 */
const checkAuth = async (req: Request, res: Response): Promise<Response> => {
  try {
    const token = req.cookies?.authToken ?? (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token found',
        authenticated: false,
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string') {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
        authenticated: false,
      });
    }

    let decoded: AuthPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as AuthPayload;
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Authentication token has expired',
          authenticated: false,
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token',
          authenticated: false,
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Token verification failed',
          authenticated: false,
        });
      }
    }

    // This endpoint is for users only; reject admin token
    if (decoded.authMethod === 'admin' && decoded.id === 'admin') {
      return res.status(401).json({
        success: false,
        message: 'No authentication token found',
        authenticated: false,
      });
    }

    // Get user from database (regular user tokens only)
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        authenticated: false,
      });
    }

    // Check if user is still active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
        authenticated: false,
      });
    }

    // For email auth, check if email is still verified
    if (user.authMethod === AuthMethod.EMAIL && !user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified',
        authenticated: false,
        requiresVerification: true,
      });
    }

    // Return user info (email/avatar from googleEmail/googleAvatar for Google users)
    const email = user.authMethod === AuthMethod.GOOGLE ? user.googleEmail : user.email;
    const avatar = user.authMethod === AuthMethod.GOOGLE ? user.googleAvatar : user.avatar;
    return res.status(200).json({
      success: true,
      message: 'User is authenticated',
      authenticated: true,
      data: {
        user: {
          id: user._id,
          email,
          name: user.name,
          authMethod: user.authMethod,
          isEmailVerified: user.authMethod === AuthMethod.GOOGLE ? true : user.isEmailVerified,
          ...(user.authMethod === AuthMethod.PHONE && { phone: `${user.phoneCountryCode || ''}${user.phone || ''}`.trim() }),
          ...(avatar && { avatar }),
          ...(user.customerId && { customerId: user.customerId }),
          ...(user.accountStatus && { accountStatus: user.accountStatus }),
        },
      },
    });
  } catch (error: any) {
    console.error('Error in checkAuth controller:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while checking authentication',
      authenticated: false,
    });
  }
};

/**
 * Check authentication status for admin (Admin app only).
 * GET /api/auth/admin/check-auth
 * Only accepts adminAuthToken cookie (or Bearer). Ignores authToken.
 */
const checkAdminAuth = async (req: Request, res: Response): Promise<Response> => {
  try {
    const token = req.cookies?.adminAuthToken ?? (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token found',
        authenticated: false,
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string') {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
        authenticated: false,
      });
    }

    let decoded: AuthPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as AuthPayload;
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Authentication token has expired',
          authenticated: false,
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        authenticated: false,
      });
    }

    if (decoded.authMethod !== 'admin' || decoded.id !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'No authentication token found',
        authenticated: false,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin is authenticated',
      authenticated: true,
      data: {
        user: {
          id: 'admin',
          email: decoded.email,
          authMethod: 'admin',
          isAdmin: true,
          permissions: decoded.permissions ?? Object.values(PERMISSIONS),
        },
      },
    });
  } catch (error: any) {
    console.error('Error in checkAdminAuth controller:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while checking authentication',
      authenticated: false,
    });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (_req: Request, res: Response): Promise<Response> => {
  try {
    // Clear the auth token cookie
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';

    const clearCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
      maxAge: 0,
      path: '/',
    };
    res.cookie('authToken', '', clearCookieOptions);
    res.cookie('adminAuthToken', '', clearCookieOptions);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Error in logout controller:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during logout. Please try again.',
    });
  }
};

/**
 * Verify phone auth (Pakistan +92 only).
 * POST /api/auth/phone/verify
 * Body (production): { idToken: string }
 * Body (dev, when USE_DUMMY_PHONE_VERIFICATION=true): { dummyPhone: string, dummyCode: string }
 */
const verifyPhone = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { idToken, dummyPhone, dummyCode } = req.body;

    let normalizedPhone: string | null = null;

    // Isolated dummy path: remove this block in production; main flow uses idToken only
    if (isDummyPhoneVerificationEnabled()) {
      const dummyVerified = getDummyVerifiedPhone(dummyPhone, dummyCode);
      if (dummyVerified) {
        normalizedPhone = dummyVerified;
      }
    }

    if (!normalizedPhone) {
      if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: isDummyPhoneVerificationEnabled()
            ? 'Provide either a valid Firebase ID token or (for dev) dummy phone and code.'
            : 'ID token is required',
        });
      }

      let decodedToken: { phone_number?: string; firebase?: { identities?: { phone?: string[] } } };
      try {
        const admin = getFirebaseAdmin();
        decodedToken = await admin.auth().verifyIdToken(idToken.trim());
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid token';
        return res.status(401).json({
          success: false,
          message: message.includes('expired') ? 'Verification expired. Please try again.' : 'Invalid or expired verification.',
        });
      }

      const rawPhone =
        decodedToken.phone_number ??
        decodedToken.firebase?.identities?.phone?.[0];

      if (!rawPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number not found in verification.',
        });
      }

      const phoneValidation = validatePakistanPhone(rawPhone);
      if (!phoneValidation.isValid || !phoneValidation.normalized) {
        return res.status(400).json({
          success: false,
          message: phoneValidation.error ?? 'Only Pakistan (+92) numbers are allowed.',
        });
      }

      normalizedPhone = phoneValidation.normalized;
    }

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number could not be verified.',
      });
    }

    const split = splitE164(normalizedPhone);
    if (!split) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format.',
      });
    }
    const { countryCode: phoneCountryCode, rest: phoneRest } = split;

    let existingUser = await User.findOne({
      phoneCountryCode,
      phone: phoneRest,
      authMethod: AuthMethod.PHONE,
    });
    if (!existingUser) {
      const legacyUser = await User.findOne({
        phone: normalizedPhone,
        authMethod: AuthMethod.PHONE,
      });
      if (legacyUser) {
        legacyUser.phoneCountryCode = phoneCountryCode;
        legacyUser.phone = phoneRest;
        await legacyUser.save();
        existingUser = legacyUser;
      }
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string') {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error.',
      });
    }

    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('strict' as const) : ('lax' as const),
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };

    const tokenExpiration = process.env.JWT_EXPIRATION || '7d';

    if (existingUser) {
      if (!existingUser.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated.',
        });
      }
      existingUser.lastLoginAt = new Date();
      await existingUser.save();
      await recordLoginActivity(existingUser._id.toString(), true, req);

      const fullPhone = `${existingUser.phoneCountryCode || ''}${existingUser.phone || ''}`.trim() || existingUser.phone;
      const tokenPayload = {
        id: existingUser._id.toString(),
        phone: fullPhone,
        authMethod: existingUser.authMethod,
      };
      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: tokenExpiration } as SignOptions);
      res.cookie('authToken', token, cookieOptions);
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            phone: fullPhone,
            authMethod: existingUser.authMethod,
            isEmailVerified: existingUser.isEmailVerified,
          },
        },
      });
    }

    const newUser = new User({
      authMethod: AuthMethod.PHONE,
      phoneCountryCode,
      phone: phoneRest,
      isPhoneVerified: true,
      isActive: true,
      lastLoginAt: new Date(),
    });

    try {
      await newUser.save();
    } catch (saveErr: unknown) {
      const mongoErr = saveErr as { code?: number; keyValue?: { phone?: string; phoneCountryCode?: string } };
      if (mongoErr.code === 11000 && (mongoErr.keyValue?.phone != null || mongoErr.keyValue?.phoneCountryCode != null)) {
        return res.status(409).json({
          success: false,
          message: 'This number is already registered.',
        });
      }
      throw saveErr;
    }

    await recordLoginActivity(newUser._id.toString(), true, req);

    const fullPhoneNew = `${newUser.phoneCountryCode || ''}${newUser.phone || ''}`.trim();
    const tokenPayload = {
      id: newUser._id.toString(),
      phone: fullPhoneNew,
      authMethod: newUser.authMethod,
    };
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: tokenExpiration } as SignOptions);
    res.cookie('authToken', token, cookieOptions);
    return res.status(200).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          phone: fullPhoneNew,
          authMethod: newUser.authMethod,
          isEmailVerified: newUser.isEmailVerified,
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Firebase Admin not configured')) {
      return res.status(503).json({
        success: false,
        message: 'Phone verification is not configured. Please contact support.',
      });
    }
    console.error('Error in verifyPhone controller:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during verification. Please try again.',
    });
  }
};

/**
 * Verify Google sign-in (Firebase ID token).
 * POST /api/auth/google/verify
 * Body: { idToken: string }
 */
const verifyGoogle = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required',
      });
    }

    let decodedToken: { uid?: string; email?: string; name?: string; picture?: string };
    try {
      const admin = getFirebaseAdmin();
      decodedToken = await admin.auth().verifyIdToken(idToken.trim());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      return res.status(401).json({
        success: false,
        message: message.includes('expired') ? 'Verification expired. Please try again.' : 'Invalid or expired verification.',
      });
    }

    const googleId = decodedToken.uid;
    if (!googleId || typeof googleId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token: missing user identifier.',
      });
    }
    let googleEmail = decodedToken.email?.trim() || undefined;
    let name = decodedToken.name?.trim() || undefined;
    let googleAvatar = decodedToken.picture?.trim() || undefined;

    if (!googleEmail || !name) {
      try {
        const admin = getFirebaseAdmin();
        const userRecord = await admin.auth().getUser(googleId);
        googleEmail = googleEmail || userRecord.email?.trim() || undefined;
        name = name || userRecord.displayName?.trim() || undefined;
        googleAvatar = googleAvatar || userRecord.photoURL?.trim() || undefined;
      } catch {
        // keep from token
      }
    }

    const existingByGoogleId = await User.findOne({
      googleId,
      authMethod: AuthMethod.GOOGLE,
    });

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string') {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error.',
      });
    }

    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('strict' as const) : ('lax' as const),
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };

    const tokenExpiration = process.env.JWT_EXPIRATION || '7d';

    if (existingByGoogleId) {
      if (!existingByGoogleId.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated.',
        });
      }
      existingByGoogleId.lastLoginAt = new Date();
      await existingByGoogleId.save();
      await recordLoginActivity(existingByGoogleId._id.toString(), true, req);

      const tokenPayload = {
        id: existingByGoogleId._id.toString(),
        authMethod: existingByGoogleId.authMethod,
      };
      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: tokenExpiration } as SignOptions);
      res.cookie('authToken', token, cookieOptions);
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: existingByGoogleId._id,
            name: existingByGoogleId.name,
            email: existingByGoogleId.googleEmail,
            avatar: existingByGoogleId.googleAvatar,
            authMethod: existingByGoogleId.authMethod,
            isEmailVerified: true,
          },
        },
      });
    }

    if (googleEmail) {
      const normalizedGoogleEmail = googleEmail.toLowerCase().trim();
      const existingByEmail = await User.findOne({
        $or: [{ email: normalizedGoogleEmail }, { googleEmail: normalizedGoogleEmail }],
      });
      if (existingByEmail) {
        if (existingByEmail.authMethod === AuthMethod.EMAIL) {
          return res.status(409).json({
            success: false,
            message: 'Account already exists. Try again with email and password.',
          });
        }
        if (existingByEmail.authMethod === AuthMethod.PHONE) {
          return res.status(409).json({
            success: false,
            message: 'Account already exists. Try again with phone number.',
          });
        }
      }
    }

    const newUser = new User({
      authMethod: AuthMethod.GOOGLE,
      googleId,
      googleEmail: googleEmail || undefined,
      googleAvatar: googleAvatar || undefined,
      name: name || undefined,
      isActive: true,
      lastLoginAt: new Date(),
    });

    try {
      await newUser.save();
    } catch (saveErr: unknown) {
      const mongoErr = saveErr as { code?: number; keyValue?: { googleId?: string } };
      if (mongoErr.code === 11000 && mongoErr.keyValue?.googleId) {
        return res.status(409).json({
          success: false,
          message: 'This account is already registered.',
        });
      }
      throw saveErr;
    }

    const tokenPayload = {
      id: newUser._id.toString(),
      authMethod: newUser.authMethod,
    };
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: tokenExpiration } as SignOptions);
    res.cookie('authToken', token, cookieOptions);
    return res.status(200).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.googleEmail,
          avatar: newUser.googleAvatar,
          authMethod: newUser.authMethod,
          isEmailVerified: true,
        },
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error in verifyGoogle controller:', err.message, err);
    if (err.message.includes('Firebase Admin not configured')) {
      return res.status(503).json({
        success: false,
        message: 'Google sign-in is not configured. Please contact support.',
      });
    }
    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(500).json({
      success: false,
      message: isDev ? err.message : 'An error occurred during sign-in. Please try again.',
    });
  }
};

export { register, login, logout, adminLogin, verifyEmail, resendVerification, checkAuth, checkAdminAuth, verifyPhone, verifyGoogle };
