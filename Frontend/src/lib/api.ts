import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Thrown by {@link apiRequest} on HTTP errors; includes status for branching (e.g. phone verify 409/404). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

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
      
      const responseData = axiosError.response?.data;
      let errorMessage = 'An error occurred';
      
      if (responseData) {
        if (responseData.message) {
          errorMessage = responseData.message;
        }
        else if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
          errorMessage = responseData.errors[0];
        }
        else if (responseData.errors && typeof responseData.errors === 'object') {
          const firstError = Object.values(responseData.errors)[0];
          errorMessage = typeof firstError === 'string' ? firstError : 'Validation error';
        }
      }
      
      throw new ApiError(errorMessage || axiosError.message || 'An error occurred', axiosError.response?.status);
    }
    throw error;
  }
}

export const authAPI = {
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

  logout: async () => {
    return apiRequest<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
    });
  },

  verifyEmail: async (token: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
    }>('/auth/verify-email', {
      method: 'GET',
      params: { token },
    });
  },

  resendVerification: async (email: string) => {
    return apiRequest<{
      success: boolean;
      message: string;
    }>('/auth/resend-verification', {
      method: 'POST',
      data: { email },
    });
  },

  verifyPhone: async (payload: { intent: 'signup' | 'login'; idToken: string }) => {
    return apiRequest<{
      success: boolean;
      message: string;
      data: {
        user: {
          id: string;
          name?: string;
          email?: string;
          phone?: string;
          avatar?: string;
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

export function getAvatarUrl(avatar: string | undefined): string | undefined {
  if (!avatar) return undefined;
  if (avatar.startsWith('http')) return avatar;
  const base = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');
  return `${base}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
}

export const customersAPI = {
  getMe: () =>
    apiRequest<{ success: boolean; data: CustomerProfileResponse }>('/customers/me', {
      method: 'GET',
    }),

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
  isCustomizable?: boolean;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

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
    tags,
    inStock: true,
    rating: p.rating ?? 0,
    reviews: p.reviewCount ?? 0,
    isTrending: tags.some((t) => /trending/i.test(t)),
    isNew: tags.some((t) => /new/i.test(t)),
  };
}

export const productsAPI = {
  getFeatured: () =>
    apiRequest<{ success: boolean; data: ProductPublic[] }>('/products/featured', {
      method: 'GET',
    }),

  getList: (params?: { categoryId?: string; categorySlug?: string }) =>
    apiRequest<{ success: boolean; data: ProductPublic[] }>('/products/public', {
      method: 'GET',
      params: params ?? {},
    }),

  getById: (id: string) =>
    apiRequest<{ success: boolean; data: ProductPublic }>(`/products/public/${id}`, {
      method: 'GET',
    }),
};

export interface StoreShippingData {
  shippingRate: number;
  freeShippingMinSubtotal: number;
}

export function computeShippingFromStore(subtotal: number, cfg: StoreShippingData): number {
  return subtotal >= cfg.freeShippingMinSubtotal ? 0 : cfg.shippingRate;
}

export const storeAPI = {
  getShipping: () =>
    apiRequest<{ success: boolean; data: StoreShippingData }>('/store/shipping', { method: 'GET' }),
};

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

export interface CartResponse {
  items: CartItemResponse[];
  subtotal: number;
  shipping: number;
  total: number;
}

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

export interface OrderLineItemResponse {
  productId: string;
  name: string;
  quantity: number;
  priceAtOrder: number;
  subtotal: number;
}

export interface OrderResponse {
  _id: string;
  orderNumber?: string;
  userId?: string;
  status: string;
  lineItems: OrderLineItemResponse[];
  subtotal: number;
  discountAmount?: number;
  discountCode?: string;
  total: number;
  currency?: string;
  transactionIds?: string[];
  shippingAddress?: ShippingAddressPayload;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingAddressPayload {
  street?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  zip?: string;
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

  getPublic: (id: string) =>
    apiRequest<{ success: boolean; data: OrderResponse }>(`/orders/public/${id}`, {
      method: 'GET',
    }),
};

export interface AddressResponse {
  _id: string;
  userId: string;
  label: string;
  street: string;
  city: string;
  province: string;
  zipCode: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const addressesAPI = {
  listMine: () =>
    apiRequest<{ success: boolean; data: { items: AddressResponse[] } }>('/addresses', {
      method: 'GET',
    }),

  create: (body: { label?: string; street: string; city: string; province?: string; zipCode?: string; isDefault?: boolean }) =>
    apiRequest<{ success: boolean; data: AddressResponse }>('/addresses', {
      method: 'POST',
      data: body,
    }),

  update: (id: string, body: { label?: string; street?: string; city?: string; province?: string; zipCode?: string; isDefault?: boolean }) =>
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
