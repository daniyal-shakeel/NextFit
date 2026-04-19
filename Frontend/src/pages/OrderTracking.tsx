import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, Package, Truck, Home, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ordersAPI, type OrderResponse } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { CURRENCY } from '@/lib/constants';

const steps = [
  { key: 'placed', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: Check },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Home },
];

function deriveTimeline(order: OrderResponse): { status: string; description: string; date: Date }[] {
  const created = order.createdAt ? new Date(order.createdAt) : new Date();
  const events: { status: string; description: string; date: Date }[] = [
    { status: 'Order placed', description: 'Your order was received.', date: created },
  ];
  const s = order.status;
  if (s === 'confirmed' || s === 'processing') {
    events.push({ status: 'Confirmed', description: 'Order has been confirmed.', date: created });
  }
  if (s === 'shipped' || s === 'delivered') {
    events.push({ status: 'Shipped', description: 'Your order is on the way.', date: created });
  }
  if (s === 'delivered') {
    events.push({ status: 'Delivered', description: 'Order was delivered.', date: created });
  }
  if (s === 'cancelled' || s === 'refunded' || s === 'partially_refunded') {
    events.push({ status: s, description: `Order status: ${s}.`, date: created });
  }
  return events;
}

const OrderTracking = () => {
  const { orderId } = useParams();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestAcknowledged, setGuestAcknowledged] = useState(false);

  const ackKey = useMemo(() => (orderId ? `nextfit.guestOrderAck.v1.${orderId}` : null), [orderId]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('Missing order id.');
      return;
    }
    setLoading(true);
    setError(null);
    const load = isAuthenticated ? ordersAPI.getMine(orderId) : ordersAPI.getPublic(orderId);
    load
      .then((res) => {
        setOrder(res.data);
        setError(null);
      })
      .catch(() => {
        setOrder(null);
        setError('Order not found or you do not have access.');
      })
      .finally(() => setLoading(false));
  }, [orderId, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setGuestAcknowledged(true);
      return;
    }
    if (!ackKey) return;
    try {
      setGuestAcknowledged(window.localStorage.getItem(ackKey) === '1');
    } catch {
      setGuestAcknowledged(false);
    }
  }, [ackKey, isAuthenticated]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading order…</p>
        <Link to={isAuthenticated ? "/account" : "/"} className="mt-4 inline-block">
          <Button variant="outline">{isAuthenticated ? "Back to Account" : "Back to Home"}</Button>
        </Link>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4 text-foreground">Order Not Found</h1>
        <p className="text-muted-foreground mb-4">{error ?? 'This order could not be loaded.'}</p>
        <Link to={isAuthenticated ? "/account" : "/"}><Button>{isAuthenticated ? "Back to Account" : "Back to Home"}</Button></Link>
      </div>
    );
  }

  const statusIndex = order.status === 'delivered' ? 3 : order.status === 'shipped' ? 2 : order.status === 'confirmed' || order.status === 'processing' ? 1 : 0;
  const timeline = deriveTimeline(order);
  const moneyCurrency = order.currency?.trim() || CURRENCY;
  const ship = order.shippingAddress;
  const shipName = [ship?.firstName, ship?.lastName].filter(Boolean).join(' ').trim();
  const shipLine = [ship?.street, ship?.city, ship?.province, ship?.zipCode].filter(Boolean).join(', ');
  const guestNoticeVisible = !isAuthenticated && !guestAcknowledged;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to={isAuthenticated ? "/account" : "/"} className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> {isAuthenticated ? "Back to Account" : "Back to Home"}
        </Link>

        {guestNoticeVisible ? (
          <Card className="border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle>Important: save your order proof</CardTitle>
              <p className="text-sm text-muted-foreground">
                You checked out as a guest. Please take a screenshot of this page now. Keep your order ID to request updates.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Order ID</p>
                <p className="font-mono text-sm">{order._id}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                We’ll send order updates to your provided contact{ship?.email ? ` (${ship.email})` : ''}. When contacting support, share the order ID above.
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  if (!ackKey) return;
                  try {
                    window.localStorage.setItem(ackKey, '1');
                  } catch {
                  }
                  setGuestAcknowledged(true);
                }}
              >
                I took a screenshot
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Order {order.orderNumber ?? order._id}</CardTitle>
                <p className="text-muted-foreground">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
              <Badge>{order.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Shipping to</p>
                <p className="font-medium text-foreground">{shipName || '—'}</p>
                <p className="text-sm text-muted-foreground">{shipLine || '—'}</p>
                <p className="text-sm text-muted-foreground">{ship?.phone || '—'}</p>
                {ship?.email ? <p className="text-sm text-muted-foreground break-all">{ship.email}</p> : null}
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Summary</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items</span>
                    <span className="font-medium text-foreground">{order.lineItems?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">
                      {moneyCurrency} {Number(order.subtotal || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold text-foreground">
                      {moneyCurrency} {Number(order.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Items</p>
              <div className="space-y-2">
                {(order.lineItems ?? []).map((li, idx) => (
                  <div key={`${String(li.productId)}-${idx}`} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{li.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {li.quantity}</p>
                    </div>
                    <p className="shrink-0 text-sm font-medium text-foreground">
                      {moneyCurrency} {Number(li.subtotal || 0).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              {steps.map((step, idx) => (
                <div key={step.key} className="flex flex-col items-center">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center border-2",
                    idx <= statusIndex ? "bg-primary border-primary text-primary-foreground" : "border-muted bg-background"
                  )}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className={cn("text-xs mt-2", idx <= statusIndex ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {timeline.map((event, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div>
                    <p className="font-medium text-foreground">{event.status}</p>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                    <p className="text-xs text-muted-foreground">{event.date.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            {order.status === 'cancelled' && (
              <Link to="/shop">
                <Button className="w-full">Reorder</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderTracking;
