import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Package,
  MapPin,
  LogOut,
  Settings,
  ChevronRight,
  ShoppingBag,
  Search,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ordersAPI, getAvatarUrl, type OrderResponse } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { CURRENCY } from '@/lib/constants';

function OrderRowActions({
  order,
  showAmount = true,
  trackLabel = 'Track',
}: {
  order: OrderResponse;
  showAmount?: boolean;
  trackLabel?: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
      {showAmount ? (
        <span className="min-w-[5rem] text-right text-sm font-medium tabular-nums text-foreground">
          {CURRENCY} {order.total}
        </span>
      ) : null}
      <Badge
        variant={order.status === 'delivered' ? 'default' : 'secondary'}
        className="inline-flex h-7 min-w-[5.5rem] shrink-0 items-center justify-center rounded-full px-2.5 text-xs font-medium capitalize"
      >
        {order.status}
      </Badge>
      <Link to={`/order/${order._id}`} className="shrink-0">
        <Button size="sm" variant="outline" className="h-9 min-w-[5.5rem] px-3">
          {trackLabel}
        </Button>
      </Link>
    </div>
  );
}

function OrderMeta({ order }: { order: OrderResponse }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-mono text-sm font-medium text-foreground">
        {order.orderNumber ?? order._id}
      </p>
      <p className="truncate text-xs text-muted-foreground sm:text-sm">
        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'} ·{' '}
        {order.lineItems?.length ?? 0} item(s)
      </p>
    </div>
  );
}

const Profile = () => {
  const { user, isAuthenticated, logout, addresses, fetchAddresses } = useStore();

  const initials = user?.name?.split(' ').map((n) => n[0]).join('') || 'U';
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [orderQuery, setOrderQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    ordersAPI
      .listMine({ page: 1, limit: 40 })
      .then((res) => setOrders(res.data.items ?? []))
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchAddresses();
  }, [isAuthenticated, fetchAddresses]);

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        (o.orderNumber ?? o._id).toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    );
  }, [orders, orderQuery]);

  const previewOrders = orders.slice(0, 3);

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-full overflow-x-hidden px-4 py-16 text-center">
        <div className="mx-auto w-full min-w-0 max-w-md">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Welcome Back</h1>
          <p className="mb-6 text-muted-foreground">Sign in to access your profile and orders</p>
          <div className="flex flex-col gap-3">
            <Link to="/auth">
              <Button className="w-full">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" className="w-full">
                Create Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8">
        <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
          <CardContent className="p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                <Avatar className="h-24 w-24 shrink-0 ring-2 ring-border/60">
                  <AvatarImage src={getAvatarUrl(user.avatar) ?? user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-primary/10 text-2xl text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col justify-center space-y-1 text-center sm:text-left">
                  <h1 className="truncate text-2xl font-bold text-foreground">{user.name}</h1>
                  <p className="truncate text-muted-foreground">{user.email}</p>
                  {user.phone && (
                    <p className="truncate text-sm text-muted-foreground">{user.phone}</p>
                  )}
                </div>
              </div>
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                <Link to="/account" className="w-full sm:w-auto">
                  <Button variant="outline" className="h-10 w-full min-w-[10rem] px-4 sm:w-auto">
                    <Settings className="mr-2 h-4 w-4 shrink-0" />
                    Edit Profile
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="h-10 w-full min-w-[10rem] px-4 sm:w-auto"
                  onClick={logout}
                >
                  <LogOut className="mr-2 h-4 w-4 shrink-0" />
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid min-h-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
          <Card className="flex min-h-0 flex-col overflow-hidden rounded-xl border-border/80 shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border/80 p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-2">
                <Package className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-lg font-semibold text-foreground">My Orders</span>
                {orders.length > 0 && (
                  <Badge variant="secondary" className="shrink-0">
                    {orders.length}
                  </Badge>
                )}
              </div>
              <Link to="/account?tab=orders" className="shrink-0">
                <Button variant="ghost" size="sm" className="h-9 gap-1">
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col p-0">
              {previewOrders.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center text-muted-foreground">
                  <ShoppingBag className="mb-3 h-10 w-10 opacity-50" />
                  <p className="text-sm">No orders yet</p>
                  <Link to="/shop" className="mt-4">
                    <Button size="sm">Start shopping</Button>
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {previewOrders.map((order) => (
                    <li
                      key={order._id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <OrderMeta order={order} />
                      </div>
                      <OrderRowActions order={order} trackLabel="Track order" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden rounded-xl border-border/80 shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border/80 p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-2">
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-lg font-semibold text-foreground">Addresses</span>
                {addresses.length > 0 && (
                  <Badge variant="secondary" className="shrink-0">
                    {addresses.length}
                  </Badge>
                )}
              </div>
              <Link to="/account?tab=addresses" className="shrink-0 text-sm font-medium text-primary hover:underline">
                Manage addresses
              </Link>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col p-4 sm:p-5">
              {addresses.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <MapPin className="mb-3 h-10 w-10 opacity-50" />
                  <p className="text-sm">No saved addresses</p>
                  <Link to="/account?tab=addresses" className="mt-4">
                    <Button size="sm" variant="outline">
                      Add address
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {addresses.slice(0, 4).map((addr) => (
                    <div
                      key={addr.id}
                      className="rounded-lg border border-border bg-muted/40 p-3 text-left"
                    >
                      <p className="font-medium text-foreground">{addr.label || 'Address'}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                        {addr.street}, {addr.city}
                        {addr.province ? `, ${addr.province}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
          <CardHeader className="space-y-4 border-b border-border/80 p-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:p-5">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-lg font-semibold text-foreground">Order Center</span>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:max-w-md sm:flex-row sm:items-center sm:justify-end">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search orders…"
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  className="h-10 w-full pl-9"
                  aria-label="Search orders"
                />
              </div>
              <Link to="/account?tab=orders" className="shrink-0 sm:ml-1">
                <Button variant="ghost" size="sm" className="h-10 w-full gap-1 sm:w-auto">
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            {filteredOrders.length === 0 ? (
              <div className="px-4 py-12 text-center text-muted-foreground">
                <ShoppingBag className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p>{orders.length === 0 ? 'No orders yet' : 'No orders match your search'}</p>
                {orders.length === 0 && (
                  <Link to="/shop">
                    <Button className="mt-4">Start shopping</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-b-xl border-t border-border/80 bg-muted/20">
                {filteredOrders.map((order) => (
                  <div
                    key={order._id}
                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5 sm:py-4"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <OrderMeta order={order} />
                    </div>
                    <OrderRowActions order={order} trackLabel="Track" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {user.measurements && (
          <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
            <CardContent className="p-5 sm:p-6 lg:p-8">
              <div className="mb-5 flex min-h-10 items-center justify-between gap-3">
                <h2 className="min-w-0 truncate text-lg font-semibold text-foreground">
                  Your measurements
                </h2>
                <Link to="/account" className="shrink-0">
                  <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 sm:px-3">
                    Update
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {user.measurements.chest ? (
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-2xl font-bold">{user.measurements.chest}"</p>
                    <p className="text-sm text-muted-foreground">Chest</p>
                  </div>
                ) : null}
                {user.measurements.waist ? (
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-2xl font-bold">{user.measurements.waist}"</p>
                    <p className="text-sm text-muted-foreground">Waist</p>
                  </div>
                ) : null}
                {user.measurements.height ? (
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-2xl font-bold">{user.measurements.height} cm</p>
                    <p className="text-sm text-muted-foreground">Height</p>
                  </div>
                ) : null}
                {user.measurements.weight ? (
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-2xl font-bold">{user.measurements.weight}</p>
                    <p className="text-sm text-muted-foreground">Weight (kg)</p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;
