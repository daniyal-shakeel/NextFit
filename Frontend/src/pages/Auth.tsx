import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Lock, User as UserIcon, ArrowRight, MailCheck, Eye, EyeOff } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup, GoogleAuthProvider, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { validatePakistanPhone } from '@/lib/phoneValidation';
import { isDummyPhoneVerificationEnabled, isDummyAllowedPhone, DUMMY_VERIFICATION_CODE, DUMMY_PHONE_DISPLAY } from '@/lib/dummyPhoneVerification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useStore } from '@/store/useStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { authAPI, customersAPI } from '@/lib/api';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'email' | 'phone' | 'google'>('email');
  const [showVerificationScreen, setShowVerificationScreen] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string>('');
  const [searchParams] = useSearchParams();
  const { login, logout, fetchCart, fetchAddresses } = useStore();
  const navigate = useNavigate();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const resendEmailRef = useRef<HTMLInputElement>(null);

  // Phone auth (Firebase): two steps — enter phone → enter OTP
  const [phoneStep, setPhoneStep] = useState<'enter_phone' | 'enter_otp'>('enter_phone');
  const [phoneOtpValue, setPhoneOtpValue] = useState('');
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const sentToPhoneRef = useRef<string>('');

  // Note: OAuth callbacks are handled by AuthCallback component
  // This component only handles the initial auth check

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
    // Check if resend verification action
    const action = searchParams.get('action');
    if (action === 'resend') {
      setShowVerificationScreen(true);
      setIsLogin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Check if user is already authenticated
   */
  const loginWithFullProfile = async (basic: { id: string; name: string; email: string; avatar?: string }) => {
    try {
      const res = await customersAPI.getMe();
      if (res.success && res.data) {
        const d = res.data;
        login({
          id: d._id,
          name: d.name ?? basic.name,
          email: d.email ?? basic.email,
          phone: d.phone,
          avatar: d.avatar ?? basic.avatar,
          measurements: d.measurements,
        });
      } else {
        login(basic);
      }
      await Promise.all([fetchCart(), fetchAddresses()]);
    } catch {
      login(basic);
      await Promise.all([fetchCart(), fetchAddresses()]);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const response = await authAPI.checkAuth();
      if (response.success && response.authenticated && response.data?.user) {
        const user = response.data.user;
        await loginWithFullProfile({
          id: user.id,
          name: user.name ?? '',
          email: user.email ?? '',
          avatar: user.avatar,
        });
        navigate('/');
      } else {
        logout();
      }
    } catch (error) {
      logout();
    }
  };

  /**
   * Handle resend verification email
   */
  const handleResendVerification = async () => {
    const email = resendEmailRef.current?.value || verificationEmail;
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.resendVerification(email);
      if (response.success) {
        toast.success(response.message || 'Verification email sent successfully!');
      } else {
        toast.error(response.message || 'Failed to send verification email.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Google OAuth: popup → Firebase ID token → backend verify → session
   */
  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const idToken = await userCredential.user.getIdToken();
      const response = await authAPI.verifyGoogle(idToken);
      if (response.success && response.data?.user) {
        const user = response.data.user;
        await loginWithFullProfile({
          id: user.id,
          name: user.name ?? '',
          email: user.email ?? '',
          avatar: user.avatar,
        });
        toast.success(response.message ?? (isLogin ? 'Welcome back!' : 'Account created successfully!'));
        navigate('/');
      } else {
        toast.error(response.message ?? 'Sign-in failed. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      if (typeof msg === 'string' && (msg.includes('account-exists') || msg.includes('Account already exists'))) {
        toast.error(msg);
      } else if (typeof msg === 'string' && msg.includes('popup')) {
        toast.error('Sign-in was cancelled or the popup was blocked.');
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Send OTP: dummy (dev) skips Firebase; production uses Firebase.
   */
  const handleSendOtp = async () => {
    const raw = phoneRef.current?.value?.trim() ?? '';
    const result = validatePakistanPhone(raw);
    if (!result.isValid) {
      toast.error(result.error ?? 'Invalid phone number');
      return;
    }
    const e164 = result.normalized!;

    if (isDummyPhoneVerificationEnabled()) {
      if (!isDummyAllowedPhone(e164)) {
        toast.error(`Use dummy number ${DUMMY_PHONE_DISPLAY}`);
        return;
      }
      sentToPhoneRef.current = e164.replace(/\D/g, '').slice(-10);
      setPhoneStep('enter_otp');
      setPhoneOtpValue('');
      toast.success(`Enter code ${DUMMY_VERIFICATION_CODE}`);
      return;
    }

    const container = document.getElementById('phone-recaptcha-container');
    if (!container) {
      toast.error('Verification not ready. Please try again.');
      return;
    }

    if (!recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'phone-recaptcha-container', {
          size: 'normal',
          callback: () => {},
        });
      } catch (err) {
        toast.error('Could not load verification. Please refresh and try again.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const confirmation = await signInWithPhoneNumber(auth, e164, recaptchaVerifierRef.current);
      confirmationResultRef.current = confirmation;
      sentToPhoneRef.current = e164.replace(/\D/g, '').slice(-10);
      setPhoneStep('enter_otp');
      setPhoneOtpValue('');
      toast.success('OTP sent to your number');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verify OTP: dummy (dev) sends dummyPhone + dummyCode; production uses Firebase idToken.
   */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = phoneOtpValue.replace(/\D/g, '');
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    if (isDummyPhoneVerificationEnabled()) {
      const tenDigits = sentToPhoneRef.current || phoneRef.current?.value?.replace(/\D/g, '').slice(-10) || '';
      const dummyPhone = tenDigits.length === 10 ? `+92${tenDigits}` : '';
      if (!dummyPhone) {
        toast.error('Session expired. Please request a new code.');
        return;
      }
      setIsLoading(true);
      try {
        const response = await authAPI.verifyPhone({ dummyPhone, dummyCode: otp });
        if (response.success && response.data?.user) {
          const user = response.data.user;
          login({
            id: user.id,
            name: user.name ?? '',
            email: user.email ?? '',
            avatar: user.avatar,
          });
          await Promise.all([fetchCart(), fetchAddresses()]);
          toast.success(response.message ?? (isLogin ? 'Welcome back!' : 'Account created!'));
          navigate('/');
        } else {
          toast.error(response.message ?? 'Something went wrong.');
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Invalid or expired code. Try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const confirmation = confirmationResultRef.current;
    if (!confirmation) {
      toast.error('Session expired. Please request a new code.');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await confirmation.confirm(otp);
      const idToken = await userCredential.user.getIdToken();
      const response = await authAPI.verifyPhone({ idToken });
      if (response.success && response.data?.user) {
        const user = response.data.user;
        await loginWithFullProfile({
          id: user.id,
          name: user.name ?? '',
          email: user.email ?? '',
          avatar: user.avatar,
        });
        toast.success(response.message ?? (isLogin ? 'Welcome back!' : 'Account created!'));
        navigate('/');
      } else {
        toast.error(response.message ?? 'Something went wrong.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid or expired code. Try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset phone flow when switching back to enter-phone step or tab
   */
  const resetPhoneFlow = () => {
    setPhoneStep('enter_phone');
    setPhoneOtpValue('');
    confirmationResultRef.current = null;
  };

  /**
   * Handle email/password form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const email = emailRef.current?.value || '';
      const password = passwordRef.current?.value || '';

      if (!email || !password) {
        toast.error('Please fill in all fields');
        setIsLoading(false);
        return;
      }

      if (isLogin) {
        // Login
        const response = await authAPI.login(email, password);
        if (response.success && response.data?.user) {
          const user = response.data.user;
          await loginWithFullProfile({
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          });
          toast.success(response.message || 'Welcome back!');
          navigate('/');
        } else {
          toast.error(response.message || 'Login failed. Please try again.');
        }
      } else {
        // Signup
        if (activeTab === 'email') {
          const name = nameRef.current?.value || '';
          if (!name) {
            toast.error('Please fill in all fields');
            setIsLoading(false);
            return;
          }

          const response = await authAPI.signup('email', {
            name,
            email,
            password,
          });
          console.log(response);
          if (response.success) {
            // Show verification screen instead of logging in
            setVerificationEmail(email);
            setShowVerificationScreen(true);
            toast.success(response.message || 'Account created successfully! Please verify your email.');
          } else {
            toast.error(response.message || 'Registration failed. Please try again.');
          }
        } else if (activeTab === 'phone') {
          // Phone flow is handled by handleSendOtp + handleVerifyOtp (Firebase + backend)
          setIsLoading(false);
          return;
        } else if (activeTab === 'google') {
          // Google is handled by handleGoogleAuth (popup + verifyGoogle)
          setIsLoading(false);
          return;
        }
      }
    } catch (error) {
      // Error from API (network error, validation error, etc.)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      toast.error(errorMessage);
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show verification screen after email signup
  if (showVerificationScreen) {
    return (
      <div className="min-h-screen py-20 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-4">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-serif font-bold mb-2">Verify Your Email</h1>
            <p className="text-muted-foreground">We've sent a verification link to your email</p>
          </div>
          
          <div className="bg-card rounded-2xl border border-border p-8">
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Please check your inbox at
                </p>
                <p className="font-medium">{verificationEmail || 'your email'}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Click the verification link in the email to activate your account.
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Didn't receive the email? Check your spam folder or resend.
                </p>
              </div>

              <div className="space-y-2">
                <Input
                  ref={resendEmailRef}
                  type="email"
                  placeholder="Enter your email"
                  defaultValue={verificationEmail}
                  disabled={isLoading}
                />
                <Button
                  onClick={handleResendVerification}
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Resend Verification Email'}
                </Button>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={() => {
                    setShowVerificationScreen(false);
                    setIsLogin(true);
                  }}
                  variant="ghost"
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-20 flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold mb-2">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
          <p className="text-muted-foreground">{isLogin ? 'Sign in to continue shopping' : 'Join NextFit today'}</p>
        </div>
        
        <div className="bg-card rounded-2xl border border-border p-8">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as 'email' | 'phone' | 'google');
              if (value !== 'phone') resetPhoneFlow();
            }}
            className="mb-6"
          >
            <TabsList className="w-full">
              <TabsTrigger value="email" className="flex-1"><Mail className="h-4 w-4 mr-2" />Email</TabsTrigger>
              <TabsTrigger value="phone" className="flex-1"><Phone className="h-4 w-4 mr-2" />Phone</TabsTrigger>
              <TabsTrigger value="google" className="flex-1">Google</TabsTrigger>
            </TabsList>
            
            <TabsContent value="email" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      ref={nameRef}
                      placeholder="Full Name"
                      className="pl-10"
                      required
                      disabled={isLoading}
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    ref={emailRef}
                    type="email"
                    placeholder="Email Address"
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="phone" className="mt-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pakistan (+92) only. Enter your 10-digit mobile number.
                  {isDummyPhoneVerificationEnabled() && (
                    <span className="block mt-1 text-xs">Dev: use {DUMMY_PHONE_DISPLAY}, code {DUMMY_VERIFICATION_CODE}</span>
                  )}
                </p>
                {phoneStep === 'enter_phone' ? (
                  <>
                    <div className="flex rounded-md border border-input bg-background overflow-hidden">
                      <span className="inline-flex items-center px-3 text-muted-foreground border-r border-input bg-muted/50 text-sm">
                        +92
                      </span>
                      <Input
                        ref={phoneRef}
                        type="tel"
                        inputMode="numeric"
                        placeholder="3001234567"
                        className="border-0 rounded-none focus-visible:ring-0"
                        maxLength={11}
                        disabled={isLoading}
                        onInput={(e) => {
                          const v = e.currentTarget.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10);
                          e.currentTarget.value = v;
                        }}
                      />
                    </div>
                    {!isDummyPhoneVerificationEnabled() && <div id="phone-recaptcha-container" />}
                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      onClick={handleSendOtp}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Sending...' : 'Send OTP'}
                      {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to +92{sentToPhoneRef.current || '…'}</p>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={phoneOtpValue}
                        onChange={setPhoneOtpValue}
                        disabled={isLoading}
                      >
                        <InputOTPGroup className="gap-2">
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                      {isLoading ? 'Please wait...' : 'Verify & Continue'}
                      {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={resetPhoneFlow}
                      disabled={isLoading}
                    >
                      Use different number
                    </Button>
                  </form>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="google" className="mt-6">
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={handleGoogleAuth}
                disabled={isLoading}
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
            </TabsContent>
          </Tabs>
          
          <div className="text-center text-sm">
            <span className="text-muted-foreground">{isLogin ? "Don't have an account?" : 'Already have an account?'}</span>
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-medium ml-1 hover:underline">{isLogin ? 'Sign Up' : 'Sign In'}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
