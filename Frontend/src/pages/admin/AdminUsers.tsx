import { useState, useEffect } from 'react';
import { Search, MoreHorizontal, UserCheck, UserX, Ban, Mail } from 'lucide-react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { adminAPI } from '@/lib/api';

interface AdminUserRow {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  accountStatus?: string;
  customerId?: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-700 border-green-500/30',
  inactive: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
  suspended: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  deleted: 'bg-red-500/20 text-red-700 border-red-500/30',
  banned: 'bg-red-500/20 text-red-700 border-red-500/30',
};

const AdminUsers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminAPI
      .listCustomers({ page: 1, limit: 100 })
      .then((res) => setUsers((res.data?.items ?? []) as AdminUserRow[]))
      .catch((err) => {
        setUsers([]);
        setError(err instanceof Error ? err.message : 'Failed to load users');
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = users.filter(user => {
    const name = (user.name ?? '').toLowerCase();
    const email = (user.email ?? '').toLowerCase();
    const phone = (user.phone ?? '').toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase()) ||
      email.includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery.toLowerCase());
    const status = user.accountStatus ?? 'active';
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Users</h1>
        <p className="text-sm md:text-base text-muted-foreground">Manage platform users</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-base md:text-lg">All Users</CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {error && <div className="px-4 py-2 text-sm text-destructive">{error}</div>}
          {loading && <div className="p-6 text-center text-muted-foreground">Loading users…</div>}
          {!loading && filteredUsers.length === 0 && <div className="p-6 text-center text-muted-foreground">No users found</div>}
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3 p-4">
            {!loading && filteredUsers.map((user) => (
              <div key={user._id} className="p-4 border border-border rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm">{(user.name ?? '').split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Mail className="h-4 w-4 mr-2" /> Send Email
                      </DropdownMenuItem>
                      {(user.accountStatus ?? 'active') === 'active' ? (
                        <DropdownMenuItem>
                          <UserX className="h-4 w-4 mr-2" /> Deactivate
                        </DropdownMenuItem>
                      ) : (user.accountStatus ?? 'active') === 'suspended' ? (
                        <DropdownMenuItem>
                          <UserCheck className="h-4 w-4 mr-2" /> Activate
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      {(user.accountStatus ?? 'active') !== 'deleted' ? (
                        <DropdownMenuItem className="text-destructive">
                          <Ban className="h-4 w-4 mr-2" /> Ban User
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem>
                          <UserCheck className="h-4 w-4 mr-2" /> Unban User
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className={statusColors[(user.accountStatus ?? 'active')]}>
                    {(user.accountStatus ?? 'active')}
                  </Badge>
                  <span className="text-muted-foreground">{user.ordersCount} orders</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium">${user.totalSpent.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{user.phone || 'No phone'}</span>
                  <span>Joined {user.joinedAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && filteredUsers.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{(user.name ?? '').split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>{user.ordersCount}</TableCell>
                    <TableCell className="font-medium">${user.totalSpent.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[(user.accountStatus ?? 'active')]}>
                        {(user.accountStatus ?? 'active')}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.joinedAt.toLocaleDateString()}</TableCell>
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
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" /> Send Email
                          </DropdownMenuItem>
                          {(user.accountStatus ?? 'active') === 'active' ? (
                            <DropdownMenuItem>
                              <UserX className="h-4 w-4 mr-2" /> Deactivate
                            </DropdownMenuItem>
                          ) : (user.accountStatus ?? 'active') === 'suspended' ? (
                            <DropdownMenuItem>
                              <UserCheck className="h-4 w-4 mr-2" /> Activate
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          {(user.accountStatus ?? 'active') !== 'deleted' ? (
                            <DropdownMenuItem className="text-destructive">
                              <Ban className="h-4 w-4 mr-2" /> Ban User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem>
                              <UserCheck className="h-4 w-4 mr-2" /> Unban User
                            </DropdownMenuItem>
                          )}
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
    </div>
  );
};

export default AdminUsers;