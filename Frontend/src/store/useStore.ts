import { create } from 'zustand';
import { CartItem, Product, Notification, ShirtCustomization, User, ChatMessage, UserMeasurements, Address } from '@/lib/types';
import { cartAPI, cartResponseToState, authAPI, addressesAPI, type AddressResponse } from '@/lib/api';

function addressResponseToSavedAddress(a: AddressResponse): SavedAddress {
  return {
    id: a._id,
    label: a.label ?? '',
    street: a.street,
    city: a.city,
    state: a.state,
    zipCode: a.zipCode,
    country: a.country,
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
  // Cart
  cart: CartItem[];
  cartTotals: CartTotals | null;
  setCartFromServer: (cart: CartItem[], totals: CartTotals) => void;
  fetchCart: () => Promise<void>;
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (productId: string, itemId?: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, itemId?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  
  // User
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  updateMeasurements: (measurements: UserMeasurements) => void;
  
  // Addresses
  addresses: SavedAddress[];
  fetchAddresses: () => Promise<void>;
  addAddress: (address: Omit<SavedAddress, 'id'>) => Promise<void>;
  updateAddress: (id: string, address: Partial<Omit<SavedAddress, 'id'>>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  
  // Customization
  currentCustomization: ShirtCustomization | null;
  setCustomization: (customization: ShirtCustomization | null) => void;
  savedDesigns: ShirtCustomization[];
  saveDesign: (design: ShirtCustomization) => void;
  deleteDesign: (id: string) => void;
  
  // AI Chat
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchHistory: string[];
  addToSearchHistory: (query: string) => void;
}

export const useStore = create<AppState>()((set, get) => ({
      // Cart
      cart: [],
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
              return {
                cart: s.cart.map((i) =>
                  i.product.id === productId && i.size === item.size && i.color === item.color
                    ? { ...i, quantity: newQty }
                    : i
                ),
              };
            }
            return { cart: [...s.cart, { ...item, quantity }] };
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
          set((s) => ({ cart: s.cart.filter((i) => i.product.id !== productId), cartTotals: null }));
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
          set((s) => ({
            cart: s.cart.map((i) =>
              i.product.id === productId ? { ...i, quantity: qty } : i
            ),
            cartTotals: null,
          }));
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
          set({ cart: [], cartTotals: null });
        }
      },
      
      // User
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: async () => {
        try {
          await authAPI.logout();
        } catch {
          // Clear state even if API fails (e.g. offline) so user is logged out locally
        }
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
      
      // Addresses
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
            state: address.state,
            zipCode: address.zipCode,
            country: address.country,
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
            state: address.state,
            zipCode: address.zipCode,
            country: address.country,
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

      // Notifications (in-memory only; no backend API)
      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
        })),
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      
      // Customization
      currentCustomization: null,
      setCustomization: (customization) => set({ currentCustomization: customization }),
      savedDesigns: [],
      saveDesign: (design) =>
        set((state) => ({
          savedDesigns: [...state.savedDesigns, design],
        })),
      deleteDesign: (id) =>
        set((state) => ({
          savedDesigns: state.savedDesigns.filter((d) => d.id !== id),
        })),
      
      // AI Chat
      chatMessages: [],
      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        })),
      clearChat: () => set({ chatMessages: [] }),
      
      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchHistory: [],
      addToSearchHistory: (query) =>
        set((state) => ({
          searchHistory: [query, ...state.searchHistory.filter((q) => q !== query)].slice(0, 10),
        })),
}));
