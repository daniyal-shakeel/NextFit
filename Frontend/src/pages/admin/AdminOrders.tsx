import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  MessageCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminAPI } from '@/lib/api';

interface AdminOrderRow {
  _id: string;
  orderNumber?: string;
  userId: string | { _id: string; customerId?: string };
  status: string;
  total: number;
  createdAt?: string;
  userName?: string;
  userEmail?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  processing: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  shipped: 'bg-indigo-500/20 text-indigo-700 border-indigo-500/30',
  delivered: 'bg-green-500/20 text-green-700 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-700 border-red-500/30',
};

const AdminOrders = () => {
  const [searchParams] = useSearchParams();
  const showConfirmedOnly = searchParams.get('confirmed') === 'true';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRow | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminAPI
      .listOrders({ page: 1, limit: 100 })
      .then((res) => setOrders((res.data?.items ?? []) as AdminOrderRow[]))
      .catch((err) => {
        setOrders([]);
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredOrders = orders.filter(order => {
    const id = order.orderNumber ?? order._id;
    const userIdStr = typeof order.userId === 'string' ? order.userId : (order.userId as { customerId?: string })?._id ?? '';
    const matchesSearch = id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userIdStr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {showConfirmedOnly ? 'Confirmed Orders' : 'All Orders'}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          {showConfirmedOnly ? 'Orders confirmed via WhatsApp' : 'Manage all customer orders'}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-base md:text-lg">Orders</CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-48 md:w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32 md:w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {error && <div className="px-4 py-2 text-sm text-destructive">{error}</div>}
          {loading && <div className="p-6 text-center text-muted-foreground">Loading orders…</div>}
          {!loading && filteredOrders.length === 0 && <div className="p-6 text-center text-muted-foreground">No orders found</div>}
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3 p-4">
            {!loading && filteredOrders.map((order) => (
              <div key={order._id} className="p-4 border border-border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm font-mono">{order.orderNumber ?? order._id}</p>
                    <p className="text-xs text-muted-foreground">{typeof order.userId === 'string' ? order.userId : (order.userId as { customerId?: string })?.customerId ?? (order.userId as { _id?: string })?._id ?? '—'}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                        <Eye className="h-4 w-4 mr-2" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Package className="h-4 w-4 mr-2" /> Process Order
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Truck className="h-4 w-4 mr-2" /> Mark as Shipped
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <XCircle className="h-4 w-4 mr-2" /> Cancel Order
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[order.status] + " text-xs"}>
                      {order.status}
                    </Badge>
                    {order.whatsappConfirmed ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" /> WA
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 text-xs">
                        <MessageCircle className="h-3 w-3 mr-1" /> Pending
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium">PKR {order.total}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{order.items.length} item(s)</span>
                  <span>{order.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
<TableBody>
                  {!loading && filteredOrders.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell className="font-medium font-mono">{order.orderNumber ?? order._id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium font-mono">{typeof order.userId === 'string' ? order.userId : (order.userId as { customerId?: string })?.customerId ?? (order.userId as { _id?: string })?._id ?? '—'}</p>
                        <p className="text-sm text-muted-foreground">—</p>
                      </div>
                    </TableCell>
                    <TableCell>{order.items.length} item(s)</TableCell>
                    <TableCell className="font-medium">PKR {order.total}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[order.status]}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.whatsappConfirmed ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                          <CheckCircle className="h-3 w-3 mr-1" /> Confirmed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                          <MessageCircle className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{order.createdAt.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                            <Eye className="h-4 w-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Package className="h-4 w-4 mr-2" /> Process Order
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Truck className="h-4 w-4 mr-2" /> Mark as Shipped
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <CheckCircle className="h-4 w-4 mr-2" /> Mark as Delivered
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <XCircle className="h-4 w-4 mr-2" /> Cancel Order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Order {selectedOrder?.id}</DialogTitle>
            <DialogDescription>Order details and timeline</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 md:space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2 text-sm md:text-base">Customer</h4>
                  <p className="text-sm md:text-base">{selectedOrder.userName}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">{selectedOrder.userEmail}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">{selectedOrder.userPhone}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-sm md:text-base">Shipping Address</h4>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {selectedOrder.shippingAddress.street}<br />
                    {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.zipCode}<br />
                    {selectedOrder.shippingAddress.country}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-semibold mb-2 text-sm md:text-base">Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 bg-accent/50 rounded-lg">
                      <img src={item.product.image} alt={item.product.name} className="h-10 w-10 md:h-12 md:w-12 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm md:text-base truncate">{item.product.name}</p>
                        <p className="text-xs md:text-sm text-muted-foreground">
                          {item.size && `Size: ${item.size}`} {item.color && `• Color: ${item.color}`} • Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium text-sm md:text-base">${item.product.price * item.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="font-semibold mb-2 text-sm md:text-base">Order Timeline</h4>
                <div className="space-y-3">
                  {selectedOrder.timeline.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm md:text-base">{event.status}</p>
                        <p className="text-xs md:text-sm text-muted-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground">{event.date.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;