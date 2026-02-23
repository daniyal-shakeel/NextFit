import { mockProducts, mockOrders as baseOrders } from './mockData';
import { Order, User, Product } from './types';

export interface AdminUser extends User {
  status: 'active' | 'inactive' | 'banned';
  ordersCount: number;
  totalSpent: number;
  joinedAt: Date;
}

export interface AdminOrder extends Order {
  userName: string;
  userEmail: string;
  userPhone: string;
  whatsappConfirmed: boolean;
}

export interface Discount {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  scope: 'global' | 'category' | 'product';
  targetId?: string;
  targetName?: string;
  active: boolean;
  startDate: Date;
  endDate: Date;
}

export interface AdminSettings {
  virtualTryOnEnabled: boolean;
  currency: string;
  taxRate: number;
  shippingFee: number;
  freeShippingThreshold: number;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'user' | 'stock' | 'system';
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

export const mockAdminUsers: AdminUser[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    status: 'active',
    ordersCount: 5,
    totalSpent: 549.95,
    joinedAt: new Date('2023-06-15'),
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1987654321',
    status: 'active',
    ordersCount: 12,
    totalSpent: 1299.88,
    joinedAt: new Date('2023-03-20'),
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    phone: '+1122334455',
    status: 'inactive',
    ordersCount: 2,
    totalSpent: 179.98,
    joinedAt: new Date('2023-09-10'),
  },
  {
    id: '4',
    name: 'Sarah Wilson',
    email: 'sarah@example.com',
    phone: '+1555666777',
    status: 'banned',
    ordersCount: 0,
    totalSpent: 0,
    joinedAt: new Date('2024-01-05'),
  },
];

export const mockAdminOrders: AdminOrder[] = [
  {
    id: 'ORD-001',
    userId: '1',
    userName: 'John Doe',
    userEmail: 'john@example.com',
    userPhone: '+1234567890',
    whatsappConfirmed: true,
    items: [{ product: mockProducts[0], quantity: 1, size: 'M', color: 'Purple Fade' }],
    status: 'shipped',
    total: 89.99,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-18'),
    shippingAddress: { street: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001', country: 'USA' },
    paymentMethod: 'Credit Card',
    timeline: [
      { status: 'Order Placed', date: new Date('2024-01-15'), description: 'Your order has been placed' },
      { status: 'Confirmed', date: new Date('2024-01-15'), description: 'Order confirmed via WhatsApp' },
      { status: 'Processing', date: new Date('2024-01-16'), description: 'Your order is being prepared' },
      { status: 'Shipped', date: new Date('2024-01-18'), description: 'Your order is on the way' },
    ],
  },
  {
    id: 'ORD-002',
    userId: '2',
    userName: 'Jane Smith',
    userEmail: 'jane@example.com',
    userPhone: '+1987654321',
    whatsappConfirmed: true,
    items: [{ product: mockProducts[2], quantity: 2, size: '32', color: 'Navy' }],
    status: 'confirmed',
    total: 259.98,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
    shippingAddress: { street: '456 Oak Ave', city: 'Los Angeles', state: 'CA', zipCode: '90001', country: 'USA' },
    paymentMethod: 'PayPal',
    timeline: [
      { status: 'Order Placed', date: new Date('2024-01-20'), description: 'Your order has been placed' },
      { status: 'Confirmed', date: new Date('2024-01-20'), description: 'Order confirmed via WhatsApp' },
    ],
  },
  {
    id: 'ORD-003',
    userId: '1',
    userName: 'John Doe',
    userEmail: 'john@example.com',
    userPhone: '+1234567890',
    whatsappConfirmed: false,
    items: [{ product: mockProducts[6], quantity: 1, color: 'Brown Leather' }],
    status: 'pending',
    total: 299.99,
    createdAt: new Date('2024-01-22'),
    updatedAt: new Date('2024-01-22'),
    shippingAddress: { street: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001', country: 'USA' },
    paymentMethod: 'Credit Card',
    timeline: [
      { status: 'Order Placed', date: new Date('2024-01-22'), description: 'Your order has been placed' },
    ],
  },
  {
    id: 'ORD-004',
    userId: '3',
    userName: 'Mike Johnson',
    userEmail: 'mike@example.com',
    userPhone: '+1122334455',
    whatsappConfirmed: true,
    items: [{ product: mockProducts[4], quantity: 1, color: 'Gold/Rose' }],
    status: 'delivered',
    total: 159.99,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
    shippingAddress: { street: '789 Pine Rd', city: 'Chicago', state: 'IL', zipCode: '60601', country: 'USA' },
    paymentMethod: 'Credit Card',
    timeline: [
      { status: 'Order Placed', date: new Date('2024-01-10'), description: 'Your order has been placed' },
      { status: 'Confirmed', date: new Date('2024-01-10'), description: 'Order confirmed via WhatsApp' },
      { status: 'Processing', date: new Date('2024-01-11'), description: 'Your order is being prepared' },
      { status: 'Shipped', date: new Date('2024-01-12'), description: 'Your order is on the way' },
      { status: 'Delivered', date: new Date('2024-01-15'), description: 'Your order has been delivered' },
    ],
  },
];

export const mockDiscounts: Discount[] = [
  {
    id: '1',
    name: 'New Year Sale',
    type: 'percentage',
    value: 20,
    scope: 'global',
    active: true,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
  },
  {
    id: '2',
    name: 'Watch Week',
    type: 'percentage',
    value: 15,
    scope: 'category',
    targetId: 'watches',
    targetName: 'Watches',
    active: true,
    startDate: new Date('2024-01-20'),
    endDate: new Date('2024-01-27'),
  },
  {
    id: '3',
    name: 'Premium Shirt Deal',
    type: 'fixed',
    value: 10,
    scope: 'product',
    targetId: '1',
    targetName: 'Gradient Fade Shirt',
    active: false,
    startDate: new Date('2024-02-01'),
    endDate: new Date('2024-02-14'),
  },
];

export const mockAdminSettings: AdminSettings = {
  virtualTryOnEnabled: true,
  currency: 'USD',
  taxRate: 8.5,
  shippingFee: 9.99,
  freeShippingThreshold: 100,
};

export const mockAdminNotifications: AdminNotification[] = [
  {
    id: '1',
    title: 'New Order Pending Confirmation',
    message: 'Order #ORD-003 is waiting for WhatsApp confirmation',
    type: 'order',
    read: false,
    createdAt: new Date(),
    actionUrl: '/admin/orders',
  },
  {
    id: '2',
    title: 'Low Stock Alert',
    message: 'Round Retro Glasses is out of stock',
    type: 'stock',
    read: false,
    createdAt: new Date(Date.now() - 3600000),
    actionUrl: '/admin/products',
  },
  {
    id: '3',
    title: 'New User Registered',
    message: 'Sarah Wilson has joined the platform',
    type: 'user',
    read: true,
    createdAt: new Date(Date.now() - 86400000),
    actionUrl: '/admin/users',
  },
];

export const adminStats = {
  totalOrders: 156,
  pendingOrders: 12,
  confirmedOrders: 8,
  totalRevenue: 24589.99,
  totalUsers: 1247,
  activeUsers: 892,
  productsInStock: 45,
  outOfStock: 3,
};
