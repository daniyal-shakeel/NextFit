/**
 * Admin API client – uses same backend as Frontend, withCredentials for cookies.
 */

function resolveApiBaseUrl(): string {
  const raw =
    (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
    "http://localhost:3001/api";
  const trimmed = raw.replace(/\/$/, "");
  if (trimmed.endsWith("/api")) return trimmed;
  return `${trimmed}/api`;
}

const VITE_BACKEND_URL = resolveApiBaseUrl();

async function request<T>(
  endpoint: string,
  options: RequestInit & { data?: object } = {}
): Promise<T> {
  const { data, ...fetchOptions } = options;
  const url = endpoint.startsWith("http") ? endpoint : `${VITE_BACKEND_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
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
    request<{ success: boolean; message: string }>("auth/admin/logout", {
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

  uploadImage: async (file: File) => {
    const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim();
    const preset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined)?.trim();
    if (!cloudName || !preset) {
      throw new Error(
        "Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in Admin/.env (unsigned upload preset in Cloudinary)."
      );
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", preset);
    fd.append("folder", "nextfit/categories");
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
      { method: "POST", body: fd }
    );
    const json = (await res.json().catch(() => ({}))) as {
      secure_url?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(json.error?.message ?? `Upload failed (${res.status})`);
    }
    if (!json.secure_url) {
      throw new Error("Upload failed");
    }
    return { success: true as const, data: { imageUrl: json.secure_url } };
  },

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

export type ProductAssistantDraftProduct = {
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  basePrice: number;
  mainImageUrl: string;
  imageUrls: [string, string, string];
  rating: number | null;
  reviewCount: number;
  features: string[];
  tags: string[];
};

export type ProductAssistantDraftErrorCode =
  | 'GROQ_API_ERROR'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'EMPTY_INPUT'
  | 'RATE_LIMIT';

export type ProductAssistantDraftResult =
  | { success: true; products: ProductAssistantDraftProduct[] }
  | {
      success: false;
      error: ProductAssistantDraftErrorCode;
      message: string;
      fields?: string[];
    };

async function postAssistantJson<T>(endpoint: string, data: object): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${VITE_BACKEND_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("__NETWORK__");
  }
  const json = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (res.status === 401 || res.status === 403) {
    throw new Error(json.message ?? `Request failed (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(
      json.message ?? "The server could not complete the request. Try again in a moment."
    );
  }
  return json as T;
}

export const aiAPI = {
  productAssistantDraft: (body: { message: string }) =>
    postAssistantJson<ProductAssistantDraftResult>("ai/product-assistant/draft", body),

  suggestDescription: (body: {
    context: string;
    name: string;
    categoryName?: string;
    mainImageUrl?: string;
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
    mainImageUrl?: string;
  }) =>
    request<{ success: boolean; data: { suggestion: string } }>("ai/suggest-tags", {
      method: "POST",
      data: body,
    }),

  suggestFeatures: (body: {
    name: string;
    categoryName?: string;
    mainImageUrl?: string;
    description?: string;
  }) =>
    request<{ success: boolean; data: { suggestion: string } }>("ai/suggest-features", {
      method: "POST",
      data: body,
    }),
};

export interface AdminIntegrationStatus {
  jwtSecretConfigured: boolean;
  adminEnvLoginConfigured: boolean;
  mongodbUriSet: boolean;
  cloudinaryConfigured: boolean;
  firebaseConfigured: boolean;
  aiServiceConfigured: boolean;
  virtualTryOnConfigured: boolean;
  emailSmtpHostConfigured: boolean;
  frontendUrl: string;
  adminUrl: string;
  nodeEnv: string;
}

export interface AdminPreferences {
  defaultStockQuantity: number;
  defaultLowStockThreshold: number;
  shippingRate: number;
  freeShippingMinSubtotal: number;
  aiDescriptionSuggestionsEnabled: boolean;
  aiTagSuggestionsEnabled: boolean;
  updatedAt: string;
}

export const settingsAPI = {
  get: () =>
    request<{
      success: boolean;
      data: { preferences: AdminPreferences; integrations: AdminIntegrationStatus };
    }>("admin/settings", { method: "GET" }),

  update: (
    body: Partial<
      Pick<
        AdminPreferences,
        | "defaultStockQuantity"
        | "defaultLowStockThreshold"
        | "shippingRate"
        | "freeShippingMinSubtotal"
        | "aiDescriptionSuggestionsEnabled"
        | "aiTagSuggestionsEnabled"
      >
    >
  ) =>
    request<{
      success: boolean;
      message: string;
      data: { preferences: AdminPreferences; integrations: AdminIntegrationStatus };
    }>("admin/settings", { method: "PATCH", data: body }),
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
  stockQuantity?: number;
  lowStockThreshold?: number;
  createdAt: string;
  updatedAt: string;
}

export const productsAPI = {
  list: (opts?: { categoryId?: string; limit?: number; skip?: number }) => {
    const params = new URLSearchParams();
    const categoryId = typeof opts === "string" ? opts : opts?.categoryId;
    const limit = typeof opts === "string" ? undefined : opts?.limit;
    const skip = typeof opts === "string" ? undefined : opts?.skip;
    if (categoryId) params.set("categoryId", categoryId);
    if (limit !== undefined) params.set("limit", String(limit));
    if (skip !== undefined) params.set("skip", String(skip));
    const q = params.toString();
    return request<{ success: boolean; data: ProductItem[]; total?: number; hasMore?: boolean }>(
      q ? `products?${q}` : "products",
      { method: "GET" }
    );
  },

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
  _id?: string;
  /** address_book = saved in Address collection; profile_embedded = legacy User.shippingAddresses */
  source?: "address_book" | "profile_embedded";
  label?: string;
  street?: string;
  city?: string;
  province?: string;
  state?: string;
  postalCode?: string;
  deliveryInstructions?: string;
  isDefault?: boolean;
}

/** Order aggregates for admin customer detail (from GET /customers/:id) */
export interface CustomerOrderInsights {
  orderCount: number;
  /** Orders that count toward totalSpent (excludes cancelled / refunded) */
  revenueOrderCount: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  currency: string;
  /** pending, confirmed, processing, shipped */
  activePipelineCount: number;
  deliveredCount: number;
  cancelledOrRefundedCount: number;
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
  insights?: CustomerOrderInsights;
  /** True when lifetime qualifying spend ≥ server threshold (admin list/detail) */
  highPaying?: boolean;
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
  list: (params?: {
    page?: number;
    limit?: number;
    skip?: number;
    status?: string;
    authMethod?: string;
    search?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.page != null) sp.set("page", String(params.page));
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.skip != null) sp.set("skip", String(params.skip));
    if (params?.status) sp.set("status", params.status);
    if (params?.authMethod) sp.set("authMethod", params.authMethod);
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString();
    return request<{
      success: boolean;
      data: {
        items: CustomerItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasMore?: boolean;
      };
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
  userId:
    | null
    | string
    | {
        _id: string;
        customerId?: string;
        name?: string;
        email?: string;
        googleEmail?: string;
      };
  status: string;
  lineItems: OrderLineItem[];
  subtotal: number;
  discountAmount: number;
  discountCode?: string;
  total: number;
  currency: string;
  shippingAddress?: {
    street?: string;
    city?: string;
    province?: string;
    zipCode?: string;
    label?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  };
  transactionIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Display ID for user: prefer server-generated customerId over MongoDB _id */
export function orderUserDisplayId(userId: OrderItem["userId"]): string {
  if (!userId) return "—";
  if (typeof userId === "string") return userId;
  if (userId?.customerId) return userId.customerId;
  return (userId as { _id?: string })?._id ?? "—";
}

/** Primary label for customer row/detail: name, else email, else display id */
export function orderCustomerName(userId: OrderItem["userId"]): string {
  if (!userId) return "Guest";
  if (typeof userId === "object" && userId !== null) {
    const name = typeof userId.name === "string" ? userId.name.trim() : "";
    if (name) return name;
    const email =
      (typeof userId.email === "string" ? userId.email.trim() : "") ||
      (typeof userId.googleEmail === "string" ? userId.googleEmail.trim() : "");
    if (email) return email;
  }
  const id = orderUserDisplayId(userId);
  return id !== "—" ? id : "Customer";
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
  list: (params?: {
    page?: number;
    limit?: number;
    skip?: number;
    userId?: string;
    status?: string | string[];
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.page != null) sp.set("page", String(params.page));
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.skip != null) sp.set("skip", String(params.skip));
    if (params?.userId) sp.set("userId", params.userId);
    if (params?.status) {
      const v = Array.isArray(params.status) ? params.status.join(",") : params.status;
      if (v) sp.set("status", v);
    }
    if (params?.dateFrom) sp.set("dateFrom", params.dateFrom);
    if (params?.dateTo) sp.set("dateTo", params.dateTo);
    const q = sp.toString();
    return request<{
      success: boolean;
      data: {
        items: OrderItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasMore?: boolean;
      };
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

export interface InventoryAnalytics {
  totalSkuCount: number;
  lowStockAlertsCount: number;
  outOfStockCount: number;
  inStockHealthyCount: number;
  totalInventoryValue: number;
  currency: string;
  mostStocked: { productId: string; name: string; stockQuantity: number } | null;
  leastStocked: { productId: string; name: string; stockQuantity: number } | null;
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    skuCount: number;
    totalUnits: number;
  }[];
  deadStock: { productId: string; name: string; stockQuantity: number }[];
  topSelling: { productId: string; name: string; unitsSold: number }[];
  slowMoving: { productId: string; name: string; unitsSold: number }[];
  restockFrequency: { productId: string; name: string; restockCount: number }[];
}

export interface InventoryStockMovement {
  _id: string;
  productId: string;
  productName: string;
  productSlug?: string;
  previousStock: number;
  newStock: number;
  previousThreshold: number;
  newThreshold: number;
  changedByEmail: string | null;
  changedById: string | null;
  createdAt: string;
}

export const inventoryAPI = {
  list: (params?: {
    limit?: number;
    skip?: number;
    stockFilter?: "" | "low" | "out" | "healthy";
    search?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.skip != null) sp.set("skip", String(params.skip));
    if (params?.stockFilter) sp.set("stockFilter", params.stockFilter);
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString();
    return request<{
      success: boolean;
      data: {
        items: InventoryItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasMore?: boolean;
      };
    }>(`inventory${q ? `?${q}` : ""}`, { method: "GET" });
  },

  analytics: () =>
    request<{ success: boolean; data: InventoryAnalytics }>("inventory/analytics", {
      method: "GET",
    }),

  movements: (params?: {
    limit?: number;
    skip?: number;
    productId?: string;
    productSearch?: string;
    changedBy?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.skip != null) sp.set("skip", String(params.skip));
    if (params?.productId) sp.set("productId", params.productId);
    if (params?.productSearch) sp.set("productSearch", params.productSearch);
    if (params?.changedBy) sp.set("changedBy", params.changedBy);
    if (params?.dateFrom) sp.set("dateFrom", params.dateFrom);
    if (params?.dateTo) sp.set("dateTo", params.dateTo);
    const q = sp.toString();
    return request<{
      success: boolean;
      data: {
        items: InventoryStockMovement[];
        total: number;
        limit: number;
        skip: number;
        hasMore: boolean;
      };
    }>(`inventory/movements${q ? `?${q}` : ""}`, { method: "GET" });
  },

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
export interface ReportProductRow {
  _id: string;
  name: string;
  slug: string;
  revenue: number;
  quantity: number;
}

export interface ReportsStats {
  totalOrders: number;
  totalRevenue: number;
  revenueOrderCount: number;
  averageOrderValue: number;
  averageOrderValuePrevious: number;
  averageOrderValueChangePercent: number | null;
  refundTotal: number;
  refundRatePercent: number;
  ordersByStatus: Record<string, number>;
  customerCount: number;
  /** Accounts with active status (not suspended/deleted). */
  activeCustomerCount?: number;
  productCount: number;
  categoryCount: number;
  lowStockCount: number;
  recentOrders: {
    _id: string;
    orderNumber?: string;
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
  cartConversion: {
    abandonedCartProducts: {
      productId: string;
      name: string;
      slug: string;
      quantityInCarts: number;
    }[];
    cartAbandonmentRatePercent: number;
    cartsWithItemsCount: number;
    cartsWithItemsNoRevenueOrderCount: number;
    wishlistedNotPurchased: {
      productId: string;
      name: string;
      slug: string;
      interestedUsers: number;
    }[];
    customersWithAbandonedCarts: {
      userId: string;
      name?: string;
      email?: string;
      customerId?: string;
      cartItemCount: number;
    }[];
  };
  productPerformance: {
    bestSellingByRevenue: ReportProductRow[];
    bestSellingByQuantity: ReportProductRow[];
    worstSellingByQuantity: ReportProductRow[];
    mostRefundedProducts: ReportProductRow[];
    mostCancelledProducts: ReportProductRow[];
  };
  revenueInsights: {
    revenueByCategory: { categoryId: string; name: string; revenue: number }[];
    topCustomersBySpend: {
      _id: string;
      totalSpend: number;
      lastOrderAt?: string;
      name?: string;
      email?: string;
      customerId?: string;
    }[];
  };
  customerRecentLogins?: {
    _id: string;
    name?: string;
    email?: string;
    customerId?: string;
    lastLoginAt?: string;
    avatar?: string;
  }[];
  customerInsights: {
    oneTimeBuyers: number;
    repeatBuyers: number;
  };
  timeBased: {
    ordersByHourUtc: { hour: number; count: number }[];
    ordersByWeekdayUtc: { weekday: number; label: string; count: number }[];
    revenueLast7Days: number;
    revenuePrevious7Days: number;
    revenueWowChangePercent: number | null;
    revenueLast30Days: number;
    revenuePrevious30Days: number;
    revenueMomChangePercent: number | null;
  };
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
