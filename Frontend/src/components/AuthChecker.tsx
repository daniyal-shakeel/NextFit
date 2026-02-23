import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { authAPI, customersAPI } from '@/lib/api';

/**
 * Component that checks authentication status on app load
 * and keeps user logged in if token is valid. Fetches full profile (phone, measurements) from /api/customers/me.
 */
export const AuthChecker = () => {
  const { login, logout, fetchCart, fetchAddresses } = useStore();

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const response = await authAPI.checkAuth();

        if (response.success && response.authenticated && response.data?.user) {
          const authUser = response.data.user;
          try {
            const profileRes = await customersAPI.getMe();
            if (profileRes.success && profileRes.data) {
              const d = profileRes.data;
              login({
                id: d._id,
                name: d.name ?? authUser.name ?? '',
                email: d.email ?? authUser.email ?? '',
                phone: d.phone,
                phoneCountryCode: d.phoneCountryCode,
                phoneNumber: d.phoneNumber,
                avatar: d.avatar,
                measurements: d.measurements,
              });
              await Promise.all([fetchCart(), fetchAddresses()]);
              return;
            }
          } catch {
            // Fall back to auth user only
          }
          login({
            id: authUser.id,
            name: authUser.name ?? '',
            email: authUser.email ?? '',
            avatar: authUser.avatar,
          });
          await Promise.all([fetchCart(), fetchAddresses()]);
        } else {
          logout();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        logout();
      }
    };

    checkAuthentication();
  }, [login, logout, fetchCart, fetchAddresses]);

  return null;
};
