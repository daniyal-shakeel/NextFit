export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string; // slug or name from API (e.g. 'shirts', 'mens-shirts')
  image: string;
  images?: string[];
  features?: string[];
  inStock: boolean;
  sizes?: string[];
  colors?: string[];
  rating: number;
  reviews: number;
  isCustomizable?: boolean;
  isTrending?: boolean;
  isNew?: boolean;
}

export interface CartItem {
  /** Backend cart line id (when synced with API); used for update/remove. */
  id?: string;
  product: Product;
  quantity: number;
  size?: string;
  color?: string;
  customization?: ShirtCustomization;
}

export interface ShirtCustomization {
  id: string;
  name: string;
  baseColor: string;
  collarColor: string;
  sleeveColor: string;
  bodyColor: string;
  elements: CustomElement[];
  createdAt: Date;
}

export interface CustomElement {
  id: string;
  type: 'tattoo' | 'logo' | 'text' | 'pattern';
  image?: string;
  text?: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  scale: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  avatar?: string;
  measurements?: UserMeasurements;
}

export interface UserMeasurements {
  chest: number;
  waist: number;
  hips: number;
  height: number;
  weight: number;
  shirtSize?: string;
  pantsSize?: string;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  createdAt: Date;
  updatedAt: Date;
  shippingAddress: Address;
  paymentMethod: string;
  timeline: OrderTimelineEvent[];
}

export interface OrderTimelineEvent {
  status: string;
  date: Date;
  description: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'promotion' | 'stock' | 'system';
  read: boolean;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  products?: Product[];
}
