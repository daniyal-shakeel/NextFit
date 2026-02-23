import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, Package, Truck, Home, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ordersAPI, type OrderResponse } from '@/lib/api';
import { useStore } from '@/store/useStore';

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

  useEffect(() => {
    if (!orderId || !isAuthenticated) {
      setLoading(false);
      if (!isAuthenticated) setError('Please sign in to view this order.');
      return;
    }
    setLoading(true);
    setError(null);
    ordersAPI
      .getMine(orderId)
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading order…</p>
        <Link to="/account" className="mt-4 inline-block"><Button variant="outline">Back to Account</Button></Link>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
        <p className="text-muted-foreground mb-4">{error ?? 'This order could not be loaded.'}</p>
        <Link to="/account"><Button>Back to Account</Button></Link>
      </div>
    );
  }

  const statusIndex = order.status === 'delivered' ? 3 : order.status === 'shipped' ? 2 : order.status === 'confirmed' || order.status === 'processing' ? 1 : 0;
  const timeline = deriveTimeline(order);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/account" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Account
        </Link>

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
            {/* Timeline */}
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

            {/* Events */}
            <div className="space-y-3">
              {timeline.map((event, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div>
                    <p className="font-medium">{event.status}</p>
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
