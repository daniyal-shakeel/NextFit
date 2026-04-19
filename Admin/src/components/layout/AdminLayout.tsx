import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Package,
  Users,
  UserCircle,
  ShoppingCart,
  BarChart3,
  Settings,
  Boxes,
  History,
  LogOut,
  ChevronRight,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { adminAPI } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/categories", label: "Categories", icon: LayoutGrid },
  { to: "/products", label: "Products", icon: Package, matchPrefix: "/products" },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/users", label: "Users", icon: UserCircle },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  {
    to: "/inventory/movements",
    label: "Stock history",
    icon: History,
    matchPrefix: "/inventory/movements",
  },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function navActive(pathname: string, item: NavItem): boolean {
  if (item.to === "/") return pathname === "/";
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  return pathname === item.to;
}

export function AdminLayout({
  title,
  userEmail,
  children,
}: {
  title: string;
  userEmail?: string | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    try {
      await adminAPI.logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold font-sans">
            N
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-base font-bold leading-tight text-foreground">NextFit</p>
            <p className="truncate font-sans text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Admin console
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = navActive(pathname, item);
            const Icon = item.icon;
            return (
              <button
                key={item.to + item.label}
                type="button"
                onClick={() => navigate(item.to)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`} aria-hidden />
                <span className="flex-1 truncate">{item.label}</span>
                {active ? <ChevronRight className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-[260px]">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <h1 className="truncate font-sans text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-[200px] truncate text-sm text-muted-foreground sm:inline" title={userEmail ?? undefined}>
              {userEmail}
            </span>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
