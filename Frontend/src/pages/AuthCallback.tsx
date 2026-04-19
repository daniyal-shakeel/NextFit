import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { authAPI, customersAPI } from '@/lib/api';
import { mapApiMeasurements } from '@/lib/mapApiMeasurements';
import { useStore } from '@/store/useStore';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, logout, fetchCart, fetchAddresses } = useStore();

  useEffect(() => {
    const handleCallback = async () => {
      const success = searchParams.get('success');
      const error = searchParams.get('error');

      if (success === 'true') {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const response = await authAPI.checkAuth();
          if (response.success && response.data.user) {
            const user = response.data.user;
            try {
              const profileRes = await customersAPI.getMe();
              if (profileRes.success && profileRes.data) {
                const d = profileRes.data;
                login({
                  id: d._id,
                  name: d.name ?? user.name ?? '',
                  email: d.email ?? user.email ?? '',
                  phone: d.phone,
                  avatar: d.avatar ?? user.avatar,
                  measurements: mapApiMeasurements(d.measurements),
                });
              } else {
                login({
                  id: user.id,
                  name: user.name ?? '',
                  email: user.email ?? '',
                  avatar: user.avatar,
                });
              }
            } catch {
              login({
                id: user.id,
                name: user.name ?? '',
                email: user.email ?? '',
                avatar: user.avatar,
              });
            }
            await Promise.all([fetchCart(), fetchAddresses()]);
            toast.success('Successfully signed in!');
            navigate('/');
          } else {
            throw new Error('Authentication failed');
          }
        } catch (error) {
          console.error('Auth check error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to complete authentication';
          toast.error(errorMessage);
          logout();
          navigate('/auth');
        }
      } else if (error) {
        toast.error(decodeURIComponent(error));
        navigate('/auth');
      } else {
        navigate('/auth');
      }
    };

    handleCallback();
  }, [searchParams, navigate, login, logout, fetchCart, fetchAddresses]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}

