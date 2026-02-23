import { useState } from 'react';
import { Plus, MoreHorizontal, Edit, Trash, Power } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
const AdminDiscounts = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [discountScope, setDiscountScope] = useState('global');
  const discounts: Array<{ id: string; code: string; type: string; value: number; scope: string; active: boolean }> = [];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Discounts</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage global and individual discounts</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Create Discount
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Discount</DialogTitle>
              <DialogDescription>Create a new discount for your products</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Discount Name</Label>
                <Input id="name" placeholder="e.g., Summer Sale" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Value</Label>
                  <Input id="value" type="number" placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <Select value={discountScope} onValueChange={setDiscountScope}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Products)</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="product">Individual Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountScope === 'category' && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shirts">Shirts</SelectItem>
                      <SelectItem value="pants">Pants</SelectItem>
                      <SelectItem value="glasses">Glasses</SelectItem>
                      <SelectItem value="watches">Watches</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {discountScope === 'product' && (
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Gradient Fade Shirt</SelectItem>
                      <SelectItem value="2">Classic White Shirt</SelectItem>
                      <SelectItem value="3">Slim Fit Navy Pants</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="active" defaultChecked />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto">Create Discount</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">All Discounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3 p-4">
            {discounts.map((discount) => (
              <div key={discount.id} className="p-4 border border-border rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{discount.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{discount.scope}</p>
                    {discount.targetName && (
                      <p className="text-xs text-muted-foreground">{discount.targetName}</p>
                    )}
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
                        <Edit className="h-4 w-4 mr-2" /> Edit Discount
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Power className="h-4 w-4 mr-2" /> 
                        {discount.active ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash className="h-4 w-4 mr-2" /> Delete Discount
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm capitalize">{discount.type}</span>
                    <span className="text-sm">
                      {discount.type === 'percentage' ? `${discount.value}%` : `$${discount.value}`}
                    </span>
                  </div>
                  <Badge variant={discount.active ? 'default' : 'secondary'} className="text-xs">
                    {discount.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {discount.startDate.toLocaleDateString()} - {discount.endDate.toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.map((discount) => (
                  <TableRow key={discount.id}>
                    <TableCell className="font-medium">{discount.name}</TableCell>
                    <TableCell className="capitalize">{discount.type}</TableCell>
                    <TableCell>
                      {discount.type === 'percentage' ? `${discount.value}%` : `$${discount.value}`}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="capitalize">{discount.scope}</p>
                        {discount.targetName && (
                          <p className="text-sm text-muted-foreground">{discount.targetName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{discount.startDate.toLocaleDateString()}</p>
                        <p className="text-muted-foreground">to {discount.endDate.toLocaleDateString()}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={discount.active ? 'default' : 'secondary'}>
                        {discount.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
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
                            <Edit className="h-4 w-4 mr-2" /> Edit Discount
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Power className="h-4 w-4 mr-2" /> 
                            {discount.active ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash className="h-4 w-4 mr-2" /> Delete Discount
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
    </div>
  );
};

export default AdminDiscounts;