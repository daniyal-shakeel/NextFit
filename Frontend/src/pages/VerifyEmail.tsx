import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { authAPI } from '@/lib/api';

type VerificationState = 'loading' | 'success' | 'error';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setState('error');
      setMessage('Verification token is missing. Please check your email and try again.');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await authAPI.verifyEmail(token);
      
      if (response.success) {
        setState('success');
        setMessage(response.message || 'Email verified successfully!');
        toast.success(response.message || 'Email verified successfully!');
      } else {
        setState('error');
        setMessage(response.message || 'Verification failed. Please try again.');
        toast.error(response.message || 'Verification failed.');
      }
    } catch (error) {
      setState('error');
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during verification.';
      setMessage(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleResendVerification = async () => {
    navigate('/auth?action=resend');
  };

  return (
    <div className="min-h-screen py-20 flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-4"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {state === 'loading' && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
              {state === 'success' && <CheckCircle2 className="h-8 w-8 text-green-500" />}
              {state === 'error' && <XCircle className="h-8 w-8 text-red-500" />}
            </div>
            <CardTitle className="text-2xl">
              {state === 'loading' && 'Verifying Email...'}
              {state === 'success' && 'Email Verified!'}
              {state === 'error' && 'Verification Failed'}
            </CardTitle>
            <CardDescription>
              {state === 'loading' && 'Please wait while we verify your email address'}
              {state === 'success' && 'Your email has been successfully verified'}
              {state === 'error' && 'We encountered an issue verifying your email'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state === 'loading' && (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Verifying your email address...</p>
              </div>
            )}

            {state === 'success' && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-200 text-sm">{message}</p>
                </div>
                <Link to="/auth">
                  <Button className="w-full" size="lg">
                    Sign In
                  </Button>
                </Link>
              </div>
            )}

            {state === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-800 dark:text-red-200 text-sm">{message}</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    The verification link may have expired or already been used.
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    Try with another email or request a new verification link.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Link to="/auth?action=resend">
                    <Button variant="outline" className="w-full">
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Verification Email
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="ghost" className="w-full">
                      Back to Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
