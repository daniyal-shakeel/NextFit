import { useState } from 'react';
import { Check, CheckCheck, Trash, Bell, ShoppingCart, Users, Package, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  order: ShoppingCart,
  user: Users,
  stock: Package,
  system: AlertCircle,
};

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: Date;
}

const AdminNotifications = () => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {unreadCount > 0 ? `You have ${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead} className="w-full sm:w-auto">
            <CheckCheck className="h-4 w-4 mr-2" /> Mark All as Read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Bell className="h-4 w-4 md:h-5 md:w-5" />
            All Notifications
            {unreadCount > 0 && (
              <Badge variant="default" className="text-xs">{unreadCount}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {notifications.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              <Bell className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm md:text-base">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {notifications.map((notification) => {
                const Icon = iconMap[notification.type] ?? AlertCircle;
                return (
                  <div 
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-3 md:gap-4 p-3 md:p-4 rounded-lg transition-colors",
                      notification.read ? "bg-accent/30" : "bg-primary/5 border border-primary/20"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0",
                      notification.read ? "bg-muted" : "bg-primary/10"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4 md:h-5 md:w-5",
                        notification.read ? "text-muted-foreground" : "text-primary"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "font-medium text-sm md:text-base truncate",
                            !notification.read && "text-foreground"
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.read && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotifications;