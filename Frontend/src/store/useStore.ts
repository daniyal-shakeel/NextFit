import { create } from 'zustand';
import { CartItem, Product, User, ChatMessage, UserMeasurements, Address } from '@/lib/types';
import { cartAPI, cartResponseToState, authAPI, addressesAPI, type AddressResponse } from '@/lib/api';

const GUEST_CART_STORAGE_KEY = 'nextfit.guestCart.v1';

function readGuestCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it): it is CartItem => {
        if (!it || typeof it !== 'object') return false;
        const i = it as Record<string, unknown>;
        const p = i.product as Record<string, unknown> | undefined;
        return (
          typeof p?.id === 'string' &&
          typeof p?.name === 'string' &&
          typeof p?.price === 'number' &&
          typeof i.quantity === 'number'
        );
      })
      .slice(0, 200);
  } catch {
    return [];
  }
}

function writeGuestCart(items: CartItem[]) {
  try {
    if (!items.length) {
      window.localStorage.removeItem(GUEST_CART_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
  }
}

function addressResponseToSavedAddress(a: AddressResponse): SavedAddress {
  return {
    id: a._id,
    label: a.label ?? '',
    street: a.street,
    city: a.city,
    province: a.province,
    zipCode: a.zipCode,
    isDefault: a.isDefault,
  };
}

const CART_MIN_QUANTITY = 1;
const CART_MAX_QUANTITY = 999;

interface SavedAddress extends Address {
  id: string;
  label: string;
  isDefault: boolean;
}

interface CartTotals {
  subtotal: number;
  shipping: number;
  total: number;
}

interface AppState {
  cart: CartItem[];
  cartTotals: CartTotals | null;
  setCartFromServer: (cart: CartItem[], totals: CartTotals) => void;
  fetchCart: () => Promise<void>;
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (productId: string, itemId?: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, itemId?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  updateMeasurements: (measurements: UserMeasurements) => void;
  
  addresses: SavedAddress[];
  fetchAddresses: () => Promise<void>;
  addAddress: (address: Omit<SavedAddress, 'id'>) => Promise<void>;
  updateAddress: (id: string, address: Partial<Omit<SavedAddress, 'id'>>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchHistory: string[];
  addToSearchHistory: (query: string) => void;
}

export const useStore = create<AppState>()((set, get) => ({
      cart: readGuestCart(),
      cartTotals: null,
      setCartFromServer: (cart, totals) => set({ cart, cartTotals: totals }),
      fetchCart: async () => {
        const state = get();
        if (!state.isAuthenticated) return;
        try {
          const res = await cartAPI.get();
          const { cart, totals } = cartResponseToState(res.data);
          set({ cart, cartTotals: totals });
        } catch {
          set({ cart: [], cartTotals: null });
        }
      },
      addToCart: async (item) => {
        const state = get();
        const productId = item?.product?.id;
        if (!productId) return;
        const quantity = Math.max(CART_MIN_QUANTITY, Math.min(CART_MAX_QUANTITY, item.quantity || 1));
        if (state.isAuthenticated) {
          try {
            const res = await cartAPI.addItem({
              productId,
              quantity,
              size: item.size,
              color: item.color,
            });
            const { cart, totals } = cartResponseToState(res.data);
            set({ cart, cartTotals: totals });
          } catch (err) {
            throw err;
          }
        } else {
          set((s) => {
            const existing = s.cart.find(
              (i) => i.product.id === productId && i.size === item.size && i.color === item.color
            );
            if (existing) {
              const newQty = Math.min(CART_MAX_QUANTITY, (existing.quantity ?? 0) + quantity);
              const nextCart = s.cart.map((i) =>
                i.product.id === productId && i.size === item.size && i.color === item.color
                  ? { ...i, quantity: newQty }
                  : i
              );
              writeGuestCart(nextCart);
              return {
                cart: s.cart.map((i) =>
                  i.product.id === productId && i.size === item.size && i.color === item.color
                    ? { ...i, quantity: newQty }
                    : i
                ),
              };
            }
            const nextCart = [...s.cart, { ...item, quantity }];
            writeGuestCart(nextCart);
            return { cart: nextCart };
          });
        }
      },
      removeFromCart: async (productId, itemId) => {
        const state = get();
        if (state.isAuthenticated) {
          const idToRemove = itemId ?? state.cart.find((i) => i.product.id === productId)?.id;
          if (!idToRemove) {
            set((s) => ({ cart: s.cart.filter((i) => i.product.id !== productId), cartTotals: null }));
            return;
          }
          try {
            const res = await cartAPI.removeItem(idToRemove);
            const { cart, totals } = cartResponseToState(res.data);
            set({ cart, cartTotals: totals });
          } catch (err) {
            throw err;
          }
        } else {
          set((s) => {
            const nextCart = s.cart.filter((i) => i.product.id !== productId);
            writeGuestCart(nextCart);
            return { cart: nextCart, cartTotals: null };
          });
        }
      },
      updateQuantity: async (productId, quantity, itemId) => {
        const state = get();
        const qty = Math.max(CART_MIN_QUANTITY, Math.min(CART_MAX_QUANTITY, quantity));
        if (state.isAuthenticated) {
          const idToUpdate = itemId ?? state.cart.find((i) => i.product.id === productId)?.id;
          if (!idToUpdate) return;
          try {
            const res = await cartAPI.updateItem(idToUpdate, qty);
            const { cart, totals } = cartResponseToState(res.data);
            set({ cart, cartTotals: totals });
          } catch (err) {
            throw err;
          }
        } else {
          set((s) => {
            const nextCart = s.cart.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i));
            writeGuestCart(nextCart);
            return { cart: nextCart, cartTotals: null };
          });
        }
      },
      clearCart: async () => {
        const state = get();
        if (state.isAuthenticated) {
          try {
            const res = await cartAPI.updateMine([]);
            const { cart, totals } = cartResponseToState(res.data);
            set({ cart, cartTotals: totals });
          } catch {
            set({ cart: [], cartTotals: null });
          }
        } else {
          writeGuestCart([]);
          set({ cart: [], cartTotals: null });
        }
      },
      
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: async () => {
        try {
          await authAPI.logout();
        } catch {
        }
        writeGuestCart([]);
        set({
          user: null,
          isAuthenticated: false,
          addresses: [],
          cart: [],
          cartTotals: null,
        });
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      updateMeasurements: (measurements) =>
        set((state) => ({
          user: state.user ? { ...state.user, measurements } : null,
        })),
      
      addresses: [],
      fetchAddresses: async () => {
        const state = get();
        if (!state.isAuthenticated) return;
        try {
          const res = await addressesAPI.listMine();
          const items = (res.data?.items ?? []).map(addressResponseToSavedAddress);
          set({ addresses: items });
        } catch {
          set({ addresses: [] });
        }
      },
      addAddress: async (address) => {
        const state = get();
        if (!state.isAuthenticated) return;
        try {
          await addressesAPI.create({
            label: address.label,
            street: address.street,
            city: address.city,
            province: address.province,
            zipCode: address.zipCode,
            isDefault: address.isDefault,
          });
          await get().fetchAddresses();
        } catch (err) {
          throw err;
        }
      },
      updateAddress: async (id, address) => {
        const state = get();
        if (!state.isAuthenticated) return;
        try {
          await addressesAPI.update(id, {
            label: address.label,
            street: address.street,
            city: address.city,
            province: address.province,
            zipCode: address.zipCode,
            isDefault: address.isDefault,
          });
          await get().fetchAddresses();
        } catch (err) {
          throw err;
        }
      },
      deleteAddress: async (id) => {
        const state = get();
        if (!state.isAuthenticated) return;
        try {
          await addressesAPI.delete(id);
          set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) }));
        } catch (err) {
          throw err;
        }
      },
      setDefaultAddress: async (id) => {
        const state = get();
        if (!state.isAuthenticated) return;
        try {
          await addressesAPI.setDefault(id);
          set((s) => ({
            addresses: s.addresses.map((a) => ({ ...a, isDefault: a.id === id })),
          }));
        } catch (err) {
          throw err;
        }
      },
      
      chatMessages: [],
      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        })),
      clearChat: () => set({ chatMessages: [] }),
      
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchHistory: [],
      addToSearchHistory: (query) =>
        set((state) => ({
          searchHistory: [query, ...state.searchHistory.filter((q) => q !== query)].slice(0, 10),
        })),
}));
