/**
 * Permission strings for JWT payload and route guards.
 * Token payload may include: { id, email, authMethod, permissions?: string[] }
 */

export const PERMISSIONS = {
  CATEGORY_CREATE: 'category.create',
  CATEGORY_READ: 'category.read',
  CATEGORY_UPDATE: 'category.update',
  CATEGORY_DELETE: 'category.delete',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_READ: 'product.read',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  AI_SUGGEST: 'ai.suggest',
  // Customer (admin: list, get one, suspend/unsuspend)
  CUSTOMER_READ_ALL: 'customer.read_all',
  CUSTOMER_READ_ONE: 'customer.read_one',
  CUSTOMER_UPDATE_STATUS: 'customer.update_status',
  // Order (admin)
  ORDER_READ: 'order.read',
  ORDER_UPDATE: 'order.update',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_UPDATE: 'inventory.update',
  REPORTS_READ: 'reports.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
