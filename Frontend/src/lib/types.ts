export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  images?: string[];
  features?: string[];
  inStock: boolean;
  sizes?: string[];
  colors?: string[];
  rating: number;
  reviews: number;
  tags?: string[];
  isTrending?: boolean;
  isNew?: boolean;
}

export interface CartItem {
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
  lastAiTryOnAt?: string;
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
  province: string;
  zipCode: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  products?: Product[];
}
