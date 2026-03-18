import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { CURRENCY } from '@/lib/constants';

const CART_MIN_Q = 1;
const CART_MAX_Q = 999;

export default function Cart() {
  const {
    cart,
    cartTotals,
    isAuthenticated,
    fetchCart,
    removeFromCart,
    updateQuantity,
  } = useStore();
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart().catch(() => toast.error('Failed to load cart'));
    }
  }, [isAuthenticated, fetchCart]);

  const subtotal = cartTotals?.subtotal ?? cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const shipping = cartTotals?.shipping ?? (subtotal > 100 ? 0 : 10);
  const total = cartTotals?.total ?? subtotal + shipping;

  const handleRemove = async (item: (typeof cart)[0]) => {
    const id = item.id ?? item.product.id;
    setUpdating(id);
    try {
      await removeFromCart(item.product.id, item.id);
      toast.success('Item removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove item');
    } finally {
      setUpdating(null);
    }
  };

  const handleQuantity = async (item: (typeof cart)[0], delta: number) => {
    const newQty = Math.max(CART_MIN_Q, Math.min(CART_MAX_Q, item.quantity + delta));
    if (newQty === item.quantity) return;
    setUpdating(item.id ?? item.product.id);
    try {
      await updateQuantity(item.product.id, newQty, item.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update quantity');
    } finally {
      setUpdating(null);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <ShoppingBag className="h-16 w-16 md:h-20 md:w-20 mx-auto text-muted-foreground mb-4 md:mb-6" />
          <h1 className="text-2xl md:text-3xl font-serif font-bold mb-3 md:mb-4">Your Cart is Empty</h1>
          <p className="text-muted-foreground mb-6 md:mb-8">Looks like you haven&apos;t added anything yet.</p>
          <Link to="/shop"><Button size="lg">Start Shopping</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 md:py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl md:text-4xl font-serif font-bold mb-6 md:mb-8">Shopping Cart</h1>
        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            {cart.map((item, index) => (
              <motion.div
                key={item.id ?? `${item.product.id}-${item.size ?? ''}-${item.color ?? ''}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col sm:flex-row gap-3 md:gap-4 p-3 md:p-4 bg-card rounded-xl border border-border"
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-full sm:w-24 h-32 sm:h-24 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{item.product.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.size && `Size: ${item.size}`} {item.color && `• Color: ${item.color}`}
                  </p>
                  {item.customization && <p className="text-xs text-primary">Custom Design</p>}
                  <p className="font-bold text-primary mt-2">{CURRENCY} {item.product.price.toFixed(2)}</p>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={updating !== null}
                    onClick={() => handleRemove(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={item.quantity <= CART_MIN_Q || updating !== null}
                      onClick={() => handleQuantity(item, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={item.quantity >= CART_MAX_Q || updating !== null}
                      onClick={() => handleQuantity(item, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-border p-4 md:p-6 h-fit lg:sticky lg:top-24">
            <h2 className="text-lg md:text-xl font-semibold mb-4 md:mb-6">Order Summary</h2>
            <div className="space-y-3 mb-4 md:mb-6">
              <div className="flex justify-between text-sm md:text-base">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{CURRENCY} {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm md:text-base">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping === 0 ? 'Free' : `${CURRENCY} ${shipping.toFixed(2)}`}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-bold text-base md:text-lg">
                <span>Total</span>
                <span className="text-primary">{CURRENCY} {total.toFixed(2)}</span>
              </div>
            </div>
            <Link to="/checkout">
              <Button className="w-full" size="lg">
                Checkout
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center mt-4">
              {cartTotals !== null ? 'Totals calculated at server.' : ''} Order confirmation will be sent via WhatsApp
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
