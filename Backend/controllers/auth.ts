import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import User, { AuthMethod } from '../models/User.js';
import EmailVerificationToken from '../models/EmailVerificationToken.js';
import { validateEmail, validateString, validatePhone, validatePakistanPhone, splitE164 } from '../utils/validation.js';
import { getFirebaseAdmin } from '../config/firebaseAdmin.js';
import { MONGODB_ERROR_CODES, MONGODB_ERROR_NAMES, HTTP_STATUS } from '../constants/errorCodes.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { generateTokenWithExpiry } from '../utils/generateToken.js';
import { hashToken } from '../utils/hashToken.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { recordLoginActivity } from '../services/loginActivity.js';
import { getEmailConfig } from '../utils/env.js';
import { getClearCookieOptions, getCookieOptions } from '../utils/cookieOptions.js';
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
   
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { authMethod, email, password, name, phone, phoneCountryCode, otpCode, googleId, googleEmail, googleAvatar }: RegisterRequestBody = req.body;

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
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        authMethod: AuthMethod.EMAIL,
      });

      if (existingUser && existingUser.isEmailVerified) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists. Please login instead.',
        });
      }

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
      
      if (existingUser && !existingUser.isEmailVerified) {
        try {
          existingUser.password = hashedPassword;
          if (validatedName) {
            existingUser.name = validatedName;
          }
          existingUser.isEmailVerified = false; 
          existingUser.emailVerifiedAt = undefined;
          await existingUser.save();
          newUser = existingUser;

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
        try {
          newUser = await User.create({
            authMethod: AuthMethod.EMAIL,
            email: normalizedEmail,
            password: hashedPassword,
            name: validatedName,
            isEmailVerified: false,
          });
        } catch (dbError: any) {
          const isDupKey =
            dbError?.code === MONGODB_ERROR_CODES.DUPLICATE_KEY ||
            dbError?.code === MONGODB_ERROR_CODES.DUPLICATE_KEY_UPDATE;
          if (isDupKey) {
            const kp = dbError.keyPattern as Record<string, unknown> | undefined;
            const duplicateOnEmail = Boolean(kp && typeof kp === 'object' && 'email' in kp);
            if (duplicateOnEmail) {
              return res.status(HTTP_STATUS.CONFLICT).json({
                success: false,
                message: 'User with this email already exists',
              });
            }
            console.error('Email signup duplicate key (non-email index):', dbError);
            return res.status(HTTP_STATUS.CONFLICT).json({
              success: false,
              message: 'Could not create account. Please try again.',
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

      const { token, expiresAt } = generateTokenWithExpiry(24); 
      const tokenHash = hashToken(token);

      try {
        await EmailVerificationToken.create({
          userId: newUser._id,
          tokenHash,
          expiresAt,
        });
      } catch (tokenError) {
        console.error('Error creating verification token:', tokenError);
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

      const config = getEmailConfig();
      const verificationUrl = `${config.appBaseUrl}/verify-email?token=${token}`;
      
      const emailResult = await sendVerificationEmail({
        to: normalizedEmail,
        name: validatedName || 'User',
        verificationUrl,
      });

      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
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

    if (authMethod === AuthMethod.PHONE) {
      return res.status(501).json({
        success: false,
        message: 'Phone/OTP registration not yet implemented',
      });
    }

    if (authMethod === AuthMethod.GOOGLE) {
      return res.status(501).json({
        success: false,
        message: 'Google OAuth registration not yet implemented',
      });
    }

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

const verifyEmail = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
    }

  
    const tokenHash = hashToken(token);


    const verificationToken = await EmailVerificationToken.findOne({
      tokenHash,
      usedAt: null,
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

const resendVerification = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail, authMethod: AuthMethod.EMAIL });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a verification email has been sent.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    await EmailVerificationToken.updateMany(
      { userId: user._id, usedAt: null },
      { usedAt: new Date() }
    );

    const { token, expiresAt } = generateTokenWithExpiry(24);
    const tokenHash = hashToken(token);

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

const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { email, password } = req.body;

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

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        requiresVerification: true,
        email: user.email,
      });
    }

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

    user.lastLoginAt = new Date();
    await user.save();
    await recordLoginActivity(user._id.toString(), true, req);

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

    const tokenExpiration = process.env.JWT_EXPIRATION || '7d';
    const token = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: tokenExpiration,
    } as SignOptions);

    res.cookie('authToken', token, getCookieOptions());

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

    res.cookie('adminAuthToken', token, getCookieOptions());

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

    if (decoded.authMethod === 'admin' && decoded.id === 'admin') {
      return res.status(401).json({
        success: false,
        message: 'No authentication token found',
        authenticated: false,
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        authenticated: false,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
        authenticated: false,
      });
    }

    if (user.authMethod === AuthMethod.EMAIL && !user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified',
        authenticated: false,
        requiresVerification: true,
      });
    }

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

const logout = async (_req: Request, res: Response): Promise<Response> => {
  try {
    res.cookie('authToken', '', getClearCookieOptions());

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

const adminLogout = async (_req: Request, res: Response): Promise<Response> => {
  try {
    res.cookie('adminAuthToken', '', getClearCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Error in adminLogout controller:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during logout. Please try again.',
    });
  }
};

const verifyPhone = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { idToken, intent } = req.body;

    const authIntent = intent === 'signup' || intent === 'login' ? intent : null;
    if (!authIntent) {
      return res.status(400).json({
        success: false,
        message: 'intent must be "signup" or "login".',
      });
    }

    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required',
      });
    }

    let normalizedPhone: string | null = null;
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
      decodedToken.phone_number ?? decodedToken.firebase?.identities?.phone?.[0];

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

    if (authIntent === 'signup' && existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this phone number already exists. Please sign in instead.',
      });
    }

    if (authIntent === 'login' && !existingUser) {
      return res.status(404).json({
        success: false,
        message: 'No account found for this phone number. Please sign up first.',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string') {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error.',
      });
    }

    const cookieOptions = getCookieOptions();
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

    const cookieOptions = getCookieOptions();
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

export { register, login, logout, adminLogout, adminLogin, verifyEmail, resendVerification, checkAuth, checkAdminAuth, verifyPhone, verifyGoogle };
