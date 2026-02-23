/**
 * API utility functions for backend communication
 */

import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Include cookies in requests
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Make an API request with automatic cookie handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: AxiosRequestConfig = {}
): Promise<T> {
  try {
    const response = await apiClient.request<T>({
      url: endpoint,
      ...options,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ 
        message?: string; 
        errors?: string[] | { [key: string]: string };
        success?: boolean;
      }>;
      
      // Extract error message from response
      const responseData = axiosError.response?.data;
      let errorMessage = 'An error occurred';
      
      if (responseData) {
        // Check for message field
        if (responseData.message) {
          errorMessage = responseData.message;
        }
        // Check for errors array
        else if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
          errorMessage = responseData.errors[0];
        }
        // Check for errors object
        else if (responseData.errors && typeof responseData.errors === 'object') {
          const firstError = Object.values(responseData.errors)[0];
          errorMessage = typeof firstError === 'string' ? firstError : 'Validation error';
        }
      }
      
      throw new Error(errorMessage || axiosError.message || 'An error occurred');
    }
    throw error;
  }
}

/**
 * Auth API functions
 */
export const authAPI = {
  /**
   * Verify Google sign-in (Firebase ID token).
   * Call after signInWithPopup on the client.
   */
  verifyGoogle: async (idToken: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
      data: {
        user: {
          id: string;
          name?: string;
          email?: string;
          avatar?: string;
          authMethod: string;
          isEmailVerified?: boolean;
        };
      };
    }>('/auth/google/verify', {
      method: 'POST',
      data: { idToken },
    });
  },

  /**
   * Signup with email and password
   */
  signup: async (authMethod: 'email' | 'phone' | 'google', data: {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    phoneCountryCode?: string;
    otpCode?: string;
    googleId?: string;
    googleEmail?: string;
    googleAvatar?: string;
  }) => {
    return apiRequest<{
      success: boolean;
      message: string;
      data: { user: { id: string; name: string; email: string; authMethod: string } };
    }>('/auth/signup', {
      method: 'POST',
      data: { authMethod, ...data },
    });
  },

  /**
   * Login with email and password
   */
  login: async (email: string, password: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
      data: {
        user: {
          id: string;
          name: string;
          email: string;
          avatar?: string;
          authMethod: string;
          isEmailVerified: boolean;
        };
      };
    }>('/auth/login', {
      method: 'POST',
      data: { email, password },
    });
  },

  /**
   * Check authentication status
   */
  checkAuth: async () => {
    return apiRequest<{
      success: boolean;
      message: string;
      authenticated: boolean;
      data?: {
        user: {
          id: string;
          name: string;
          email: string;
          avatar?: string;
          authMethod: string;
          isEmailVerified: boolean;
        };
      };
    }>('/auth/check-auth', {
      method: 'GET',
    });
  },

  /**
   * Logout user
   */
  logout: async () => {
    return apiRequest<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
    });
  },

  /**
   * Verify email with token
   */
  verifyEmail: async (token: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
    }>('/auth/verify-email', {
      method: 'GET',
      params: { token },
    });
  },

  /**
   * Resend verification email
   */
  resendVerification: async (email: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
    }>('/auth/resend-verification', {
      method: 'POST',
      data: { email },
    });
  },

  /**
   * Verify phone auth and login/register (Pakistan +92 only).
   * Production: send idToken from Firebase. Dev (dummy): send dummyPhone + dummyCode when enabled.
   */
  verifyPhone: async (payload: { idToken?: string; dummyPhone?: string; dummyCode?: string }) => {
    return apiRequest<{
      success: boolean;
      message: string;
      data: {
        user: {
          id: string;
          name?: string;
          email?: string;
          phone?: string;
          authMethod: string;
          isEmailVerified?: boolean;
        };
      };
    }>('/auth/phone/verify', {
      method: 'POST',
      data: payload,
    });
  },
};

/** Customer profile from API (GET/PUT /api/customers/me) */
export interface CustomerProfileResponse {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  avatar?: string;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    height?: number;
    weight?: number;
    shirtSize?: string;
    pantsSize?: string;
  };
  [key: string]: unknown;
}

/** Resolve avatar URL (relative API path to full URL for display). */
export function getAvatarUrl(avatar: string | undefined): string | undefined {
  if (!avatar) return undefined;
  if (avatar.startsWith('http')) return avatar;
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');
  return `${base}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
}

export const customersAPI = {
  /** Get current customer profile (personal info + body measurements). Requires auth. */
  getMe: () =>
    apiRequest<{ success: boolean; data: CustomerProfileResponse }>('/customers/me', {
      method: 'GET',
    }),

  /** Update current customer profile (name, email, avatar URL, phone = countryCode + rest, measurements). */
  updateMe: (body: {
    name?: string;
    email?: string;
    avatar?: string;
    phoneCountryCode?: string;
    phone?: string;
    measurements?: {
      chest?: number;
      waist?: number;
      hips?: number;
      height?: number;
      weight?: number;
      shirtSize?: string;
      pantsSize?: string;
    };
  }) =>
    apiRequest<{ success: boolean; message?: string; data: CustomerProfileResponse }>('/customers/me', {
      method: 'PUT',
      data: body,
    }),

  /** Upload avatar image (multipart, max 10MB). Field name: avatar. */
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const response = await apiClient.post<{ success: boolean; message?: string; data: CustomerProfileResponse }>(
        '/customers/me/avatar',
        formData,
        { headers: { 'Content-Type': undefined } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string } | undefined;
        throw new Error(data?.message || error.message || 'Upload failed');
      }
      throw error;
    }
  },
};

/**
 * Public categories (landing / shop). Uses VITE_API_URL from .env.
 */
export interface CategoryPublic {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  description?: string;
  productCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export const categoriesAPI = {
  getList: () =>
    apiRequest<{ success: boolean; data: CategoryPublic[] }>('/categories/public', {
      method: 'GET',
    }),
};

/**
 * Product from API (public endpoints).
 */
export interface ProductPublic {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: { _id: string; name: string; slug: string } | string;
  basePrice: number;
  mainImageUrl: string;
  imageUrls: string[];
  features: string[];
  rating: number;
  reviewCount: number;
  isCustomizable: boolean;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Map API product to frontend Product type.
 */
export function apiProductToProduct(p: ProductPublic): import('@/lib/types').Product {
  const category =
    typeof p.categoryId === 'object' && p.categoryId !== null && 'slug' in p.categoryId
      ? (p.categoryId as { slug: string }).slug
      : String(p.categoryId);
  const tags = p.tags ?? [];
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.basePrice,
    category,
    image: p.mainImageUrl,
    images: p.imageUrls,
    features: p.features,
    inStock: true,
    rating: p.rating ?? 0,
    reviews: p.reviewCount ?? 0,
    isCustomizable: p.isCustomizable ?? false,
    isTrending: tags.some((t) => /trending/i.test(t)),
    isNew: tags.some((t) => /new/i.test(t)),
  };
}

export const productsAPI = {
  /** Featured products for landing (4: at least 1 tagged + latest). */
  getFeatured: () =>
    apiRequest<{ success: boolean; data: ProductPublic[] }>('/products/featured', {
      method: 'GET',
    }),

  /** All products (public). Optional categoryId or categorySlug. */
  getList: (params?: { categoryId?: string; categorySlug?: string }) =>
    apiRequest<{ success: boolean; data: ProductPublic[] }>('/products/public', {
      method: 'GET',
      params: params ?? {},
    }),

  /** Single product by ID (public). */
  getById: (id: string) =>
    apiRequest<{ success: boolean; data: ProductPublic }>(`/products/public/${id}`, {
      method: 'GET',
    }),
};

/** Cart item from API (server-calculated prices). */
export interface CartItemResponse {
  id: string;
  productId: string;
  product: { id: string; name: string; basePrice: number; mainImageUrl?: string };
  quantity: number;
  size?: string;
  color?: string;
  unitPrice: number;
  lineTotal: number;
}

/** Cart API response (totals calculated at server). */
export interface CartResponse {
  items: CartItemResponse[];
  subtotal: number;
  shipping: number;
  total: number;
}

/** Map API cart to store CartItem[] and totals. */
export function cartResponseToState(
  data: CartResponse
): { cart: import('@/lib/types').CartItem[]; totals: { subtotal: number; shipping: number; total: number } } {
  const cart: import('@/lib/types').CartItem[] = data.items.map((it) => ({
    id: it.id,
    product: {
      id: it.product.id,
      name: it.product.name,
      description: '',
      price: it.unitPrice,
      category: '',
      image: it.product.mainImageUrl ?? '',
      inStock: true,
      rating: 0,
      reviews: 0,
    },
    quantity: it.quantity,
    size: it.size,
    color: it.color,
  }));
  return {
    cart,
    totals: { subtotal: data.subtotal, shipping: data.shipping, total: data.total },
  };
}

export interface CartUpdateItemBody {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

export const cartAPI = {
  get: () =>
    apiRequest<{ success: boolean; data: CartResponse }>('/cart', { method: 'GET' }),

  /** Replace entire cart (e.g. pass [] to clear). */
  updateMine: (items: CartUpdateItemBody[]) =>
    apiRequest<{ success: boolean; data: CartResponse }>('/cart', {
      method: 'PUT',
      data: { items },
    }),

  addItem: (body: { productId: string; quantity: number; size?: string; color?: string }) =>
    apiRequest<{ success: boolean; data: CartResponse }>('/cart/items', {
      method: 'POST',
      data: body,
    }),

  updateItem: (itemId: string, quantity: number) =>
    apiRequest<{ success: boolean; data: CartResponse }>(`/cart/items/${itemId}`, {
      method: 'PATCH',
      data: { quantity },
    }),

  removeItem: (itemId: string) =>
    apiRequest<{ success: boolean; data: CartResponse }>(`/cart/items/${itemId}`, {
      method: 'DELETE',
    }),
};

/** Order line item from API */
export interface OrderLineItemResponse {
  productId: string;
  name: string;
  quantity: number;
  priceAtOrder: number;
  subtotal: number;
}

/** Order from API (customer orders) */
export interface OrderResponse {
  _id: string;
  orderNumber?: string; // Server-generated display ID (e.g. ORD-XXXXXXXXXX)
  userId: string;
  status: string;
  lineItems: OrderLineItemResponse[];
  subtotal: number;
  discountAmount?: number;
  discountCode?: string;
  total: number;
  currency?: string;
  transactionIds?: string[];
  createdAt: string;
  updatedAt: string;
}

/** Shipping snapshot for order create */
export interface ShippingAddressPayload {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  zip?: string;
  country?: string;
  label?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export const ordersAPI = {
  create: (body: {
    lineItems: { productId: string; quantity: number }[];
    discountCode?: string;
    addressId?: string;
    shippingAddress?: ShippingAddressPayload;
    saveAddress?: boolean;
    setAsDefault?: boolean;
  }) =>
    apiRequest<{ success: boolean; message: string; data: OrderResponse }>('/orders', {
      method: 'POST',
      data: body,
    }),

  listMine: (params?: { page?: number; limit?: number }) =>
    apiRequest<{
      success: boolean;
      data: {
        items: OrderResponse[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>('/orders/me', {
      method: 'GET',
      params: params ?? {},
    }),

  getMine: (id: string) =>
    apiRequest<{ success: boolean; data: OrderResponse }>(`/orders/me/${id}`, {
      method: 'GET',
    }),
};

// ---------------------------------------------------------------------------
// Addresses API (customer auth)
// ---------------------------------------------------------------------------

export interface AddressResponse {
  _id: string;
  userId: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const addressesAPI = {
  listMine: () =>
    apiRequest<{ success: boolean; data: { items: AddressResponse[] } }>('/addresses', {
      method: 'GET',
    }),

  create: (body: { label?: string; street: string; city: string; state?: string; zipCode?: string; country?: string; isDefault?: boolean }) =>
    apiRequest<{ success: boolean; data: AddressResponse }>('/addresses', {
      method: 'POST',
      data: body,
    }),

  update: (id: string, body: { label?: string; street?: string; city?: string; state?: string; zipCode?: string; country?: string; isDefault?: boolean }) =>
    apiRequest<{ success: boolean; data: AddressResponse }>(`/addresses/${id}`, {
      method: 'PATCH',
      data: body,
    }),

  delete: (id: string) =>
    apiRequest<{ success: boolean; message?: string }>(`/addresses/${id}`, {
      method: 'DELETE',
    }),

  setDefault: (id: string) =>
    apiRequest<{ success: boolean; data: AddressResponse }>(`/addresses/${id}/default`, {
      method: 'PATCH',
    }),
};

// ---------------------------------------------------------------------------
// Admin API (requires admin auth; returns 403 when not admin)
// ---------------------------------------------------------------------------

export interface AdminStats {
  totalOrders: number;
  totalRevenue: number;
  ordersByStatus: Record<string, number>;
  customerCount: number;
  productCount: number;
  categoryCount: number;
  lowStockCount: number;
  recentOrders: Array<{ _id: string; userId: unknown; status: string; total: number; createdAt: string }>;
  lowStockProducts: Array<{ _id: string; name: string; slug: string; stockQuantity: number; lowStockThreshold: number }>;
}

export const adminAPI = {
  getStats: (params?: { startDate?: string; endDate?: string }) =>
    apiRequest<{ success: boolean; data: AdminStats }>('/reports', {
      method: 'GET',
      params: params ?? {},
    }),

  listOrders: (params?: { page?: number; limit?: number; userId?: string }) =>
    apiRequest<{ success: boolean; data: { items: unknown[]; total: number; page: number; limit: number; totalPages: number } }>(
      '/orders',
      { method: 'GET', params: params ?? {} }
    ),

  listCustomers: (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    apiRequest<{ success: boolean; data: { items: unknown[]; total: number; page: number; limit: number; totalPages: number } }>(
      '/customers',
      { method: 'GET', params: params ?? {} }
    ),
};
