import { useEffect, useState } from 'react';
import { 
  ShoppingCart, 
  Users, 
  Package, 
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { adminAPI, type AdminStats } from '@/lib/api';
import { CURRENCY } from '@/lib/constants';

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendLabel 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
}) => (
  <Card>
    <CardContent className="p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm text-muted-foreground truncate">{title}</p>
          <p className="text-xl md:text-2xl font-bold mt-1">{value}</p>
          {trend !== undefined && (
            <p className={`text-xs md:text-sm mt-1 flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`h-3 w-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              <span className="truncate">{trend}% {trendLabel}</span>
            </p>
          )}
        </div>
        <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 ml-3">
          <Icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminAPI
      .getStats()
      .then((res) => setStats(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const recentOrders = stats?.recentOrders ?? [];
  const pendingOrders = stats?.ordersByStatus?.pending ?? 0;
  const confirmedOrders = stats?.ordersByStatus?.confirmed ?? 0;
  const lowStockCount = stats?.lowStockCount ?? 0;

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground">Welcome back to NextFit Admin</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard 
          title="Total Revenue" 
          value={stats ? `${CURRENCY} ${(stats.totalRevenue ?? 0).toLocaleString()}` : '—'}
          icon={DollarSign}
        />
        <StatCard 
          title="Total Orders" 
          value={stats?.totalOrders ?? 0}
          icon={ShoppingCart}
        />
        <StatCard 
          title="Total Users" 
          value={stats?.customerCount ?? 0}
          icon={Users}
        />
        <StatCard 
          title="Products" 
          value={stats?.productCount ?? 0}
          icon={Package}
        />
      </div>

      {/* Order Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold">{pendingOrders}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Pending Orders</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold">{confirmedOrders}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Confirmed Orders</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold">{lowStockCount}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Low Stock</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-3 md:pb-4">
            <CardTitle className="text-base md:text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4">
              {recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent orders</p>
              ) : (
                recentOrders.map((order) => (
                  <div key={order._id} className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-accent/50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm md:text-base truncate font-mono">{order._id}</p>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">{String(order.userId)}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-medium text-sm md:text-base">{CURRENCY} {order.total}</p>
                      <Badge 
                        variant={
                          order.status === 'delivered' ? 'default' :
                          order.status === 'shipped' ? 'secondary' :
                          order.status === 'confirmed' ? 'outline' : 'destructive'
                        }
                        className="text-xs"
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Notifications - no backend; show empty */}
        <Card>
          <CardHeader className="pb-3 md:pb-4">
            <CardTitle className="text-base md:text-lg">Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No notifications</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;