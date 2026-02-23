/**
 * Admin API client – uses same backend as Frontend, withCredentials for cookies.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

async function request<T>(
  endpoint: string,
  options: RequestInit & { data?: object } = {}
): Promise<T> {
  const { data, ...fetchOptions } = options;
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...fetchOptions,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
    ...(data !== undefined && { body: JSON.stringify(data) }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    [key: string]: unknown;
  };

  if (!res.ok) {
    const message = json.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }

  return json as T;
}

export interface AdminUser {
  id: string;
  email: string;
  authMethod: string;
  isAdmin: boolean;
  permissions?: string[];
}

export const adminAPI = {
  login: (email: string, password: string) =>
    request<{
      success: boolean;
      message: string;
      data: { user: AdminUser };
    }>("auth/admin/login", {
      method: "POST",
      data: { email, password },
    }),

  checkAuth: () =>
    request<{
      success: boolean;
      authenticated: boolean;
      data?: { user: AdminUser };
    }>("auth/admin/check-auth", { method: "GET" }),

  logout: () =>
    request<{ success: boolean; message: string }>("auth/logout", {
      method: "POST",
    }),
};

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  description?: string;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export const categoriesAPI = {
  list: () =>
    request<{ success: boolean; data: CategoryItem[] }>("categories", {
      method: "GET",
    }),

  get: (id: string) =>
    request<{ success: boolean; data: CategoryItem }>(`categories/${id}`, {
      method: "GET",
    }),

  create: (body: { name: string; imageUrl: string; description?: string }) =>
    request<{ success: boolean; message: string; data: CategoryItem }>("categories", {
      method: "POST",
      data: body,
    }),

  update: (
    id: string,
    body: { name?: string; imageUrl?: string; description?: string }
  ) =>
    request<{ success: boolean; message: string; data: CategoryItem }>(
      `categories/${id}`,
      { method: "PUT", data: body }
    ),

  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`categories/${id}`, {
      method: "DELETE",
    }),
};

export const aiAPI = {
  suggestDescription: (body: {
    context: string;
    name: string;
    optionalKeywords?: string;
  }) =>
    request<{ success: boolean; data: { suggestion: string } }>("ai/suggest-description", {
      method: "POST",
      data: body,
    }),

  suggestTags: (body: {
    name?: string;
    description?: string;
    categoryName?: string;
  }) =>
    request<{ success: boolean; data: { suggestion: string } }>("ai/suggest-tags", {
      method: "POST",
      data: body,
    }),
};

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string | { _id: string; name: string; slug: string };
  basePrice: number;
  mainImageUrl: string;
  imageUrls: string[];
  features: string[];
  rating: number;
  reviewCount: number;
  isCustomizable: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const productsAPI = {
  list: (categoryId?: string) =>
    request<{ success: boolean; data: ProductItem[] }>(
      categoryId ? `products?categoryId=${encodeURIComponent(categoryId)}` : "products",
      { method: "GET" }
    ),

  get: (id: string) =>
    request<{ success: boolean; data: ProductItem }>(`products/${id}`, { method: "GET" }),

  create: (body: {
    name: string;
    description: string;
    categoryId: string;
    basePrice: number;
    mainImageUrl: string;
    imageUrls?: string[];
    features?: string[];
    tags?: string[];
    isCustomizable?: boolean;
    rating?: number;
    reviewCount?: number;
  }) =>
    request<{ success: boolean; message: string; data: ProductItem }>("products", {
      method: "POST",
      data: body,
    }),

  update: (
    id: string,
    body: {
      name?: string;
      description?: string;
      categoryId?: string;
      basePrice?: number;
      mainImageUrl?: string;
      imageUrls?: string[];
      features?: string[];
      tags?: string[];
      isCustomizable?: boolean;
      rating?: number;
      reviewCount?: number;
    }
  ) =>
    request<{ success: boolean; message: string; data: ProductItem }>(`products/${id}`, {
      method: "PUT",
      data: body,
    }),

  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`products/${id}`, { method: "DELETE" }),
};

// ——— Customers (admin) ———
export interface ShippingAddressItem {
  label?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  deliveryInstructions?: string;
  isDefault?: boolean;
}

export interface BillingAddressItem {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface PaymentMethodItem {
  paymentToken: string;
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

export interface CustomerItem {
  _id: string;
  customerId?: string;
  name?: string;
  email?: string;
  googleEmail?: string;
  authMethod: string;
  accountStatus: string;
  phone?: string;
  avatar?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  shippingAddresses?: ShippingAddressItem[];
  defaultShippingAddressIndex?: number;
  billingAddress?: BillingAddressItem | null;
  paymentMethods?: PaymentMethodItem[];
}

export interface LoginActivityItem {
  _id: string;
  userId: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  createdAt: string;
}

export const customersAPI = {
  list: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page != null) sp.set("page", String(params.page));
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.status) sp.set("status", params.status);
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString();
    return request<{
      success: boolean;
      data: { items: CustomerItem[]; total: number; page: number; limit: number; totalPages: number };
    }>(`customers${q ? `?${q}` : ""}`, { method: "GET" });
  },

  get: (id: string) =>
    request<{ success: boolean; data: CustomerItem }>(`customers/${id}`, { method: "GET" }),

  getLoginActivity: (id: string, limit?: number) =>
    request<{ success: boolean; data: LoginActivityItem[] }>(
      `customers/${id}/login-activity${limit != null ? `?limit=${limit}` : ""}`,
      { method: "GET" }
    ),

  updateStatus: (id: string, status: "active" | "suspended") =>
    request<{ success: boolean; message: string; data: CustomerItem }>(`customers/${id}/status`, {
      method: "PATCH",
      data: { status },
    }),
};

// ——— Invoices (admin) ———
export interface InvoiceItem {
  _id: string;
  invoiceNumber: string;
  userId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const invoicesAPI = {
  list: (params?: { page?: number; limit?: number; userId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page != null) sp.set("page", String(params.page));
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.userId) sp.set("userId", params.userId);
    const q = sp.toString();
    return request<{
      success: boolean;
      data: { items: InvoiceItem[]; total: number; page: number; limit: number; totalPages: number };
    }>(`invoices${q ? `?${q}` : ""}`, { method: "GET" });
  },
};

// ——— Orders (admin) ———
export interface OrderLineItem {
  productId: string;
  name: string;
  quantity: number;
  priceAtOrder: number;
  subtotal: number;
}

export interface OrderItem {
  _id: string;
  orderNumber?: string; // Server-generated display ID (e.g. ORD-XXXXXXXXXX)
  userId: string | { _id: string; customerId?: string }; // populated: { _id, customerId } for display
  status: string;
  lineItems: OrderLineItem[];
  subtotal: number;
  discountAmount: number;
  discountCode?: string;
  total: number;
  currency: string;
  transactionIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Display ID for user: prefer server-generated customerId over MongoDB _id */
export function orderUserDisplayId(userId: OrderItem["userId"]): string {
  if (typeof userId === "string") return userId;
  if (userId?.customerId) return userId.customerId;
  return (userId as { _id?: string })?._id ?? "—";
}

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const;

export const ordersAPI = {
  list: (params?: { page?: number; limit?: number; userId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page != null) sp.set("page", String(params.page));
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.userId) sp.set("userId", params.userId);
    const q = sp.toString();
    return request<{
      success: boolean;
      data: { items: OrderItem[]; total: number; page: number; limit: number; totalPages: number };
    }>(`orders${q ? `?${q}` : ""}`, { method: "GET" });
  },

  get: (id: string) =>
    request<{ success: boolean; data: OrderItem }>(`orders/${id}`, { method: "GET" }),

  updateStatus: (id: string, status: string) =>
    request<{ success: boolean; message: string; data: OrderItem }>(`orders/${id}/status`, {
      method: "PATCH",
      data: { status },
    }),
};

// ——— Inventory (admin) ———
export interface InventoryItem {
  id: string;
  name: string;
  slug: string;
  categoryId: string | { _id: string; name: string; slug: string };
  basePrice: number;
  mainImageUrl: string;
  stockQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export const inventoryAPI = {
  list: () =>
    request<{ success: boolean; data: { items: InventoryItem[] } }>("inventory", {
      method: "GET",
    }),

  updateStock: (
    productId: string,
    body: { stockQuantity?: number; lowStockThreshold?: number }
  ) =>
    request<{
      success: boolean;
      message: string;
      data: { id: string; stockQuantity: number; lowStockThreshold: number };
    }>(`inventory/${productId}/stock`, {
      method: "PATCH",
      data: body,
    }),
};

// ——— Reports (admin) ———
export interface ReportsStats {
  totalOrders: number;
  totalRevenue: number;
  ordersByStatus: Record<string, number>;
  customerCount: number;
  productCount: number;
  categoryCount: number;
  lowStockCount: number;
  recentOrders: {
    _id: string;
    userId: unknown;
    status: string;
    total: number;
    createdAt: string;
  }[];
  lowStockProducts: {
    _id: string;
    name: string;
    slug: string;
    stockQuantity: number;
    lowStockThreshold: number;
  }[];
}

export const reportsAPI = {
  getStats: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set("startDate", params.startDate);
    if (params?.endDate) sp.set("endDate", params.endDate);
    const q = sp.toString();
    return request<{ success: boolean; data: ReportsStats }>(
      `reports${q ? `?${q}` : ""}`,
      { method: "GET" }
    );
  },
};
