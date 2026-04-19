import { useEffect, useState, type ReactNode } from "react";
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
  Menu,
  X,
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    try {
      await adminAPI.logout();
    } finally {
      setMobileNavOpen(false);
      navigate("/login", { replace: true });
    }
  };

  const goNav = (to: string) => {
    navigate(to);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(260px,85vw)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out lg:w-[260px] ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold font-sans">
            N
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-base font-bold leading-tight text-foreground">NextFit</p>
            <p className="truncate font-sans text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Admin console
            </p>
          </div>
          <button
            type="button"
            className="lg:hidden inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sidebar-border text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav id="admin-sidebar-nav" className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = navActive(pathname, item);
            const Icon = item.icon;
            return (
              <button
                key={item.to + item.label}
                type="button"
                onClick={() => goNav(item.to)}
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

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-0 lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              className="lg:hidden -ml-0 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => setMobileNavOpen(true)}
              aria-expanded={mobileNavOpen}
              aria-controls="admin-sidebar-nav"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <h1 className="truncate font-sans text-base font-semibold tracking-tight text-foreground sm:text-lg">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-[200px] truncate text-sm text-muted-foreground sm:inline" title={userEmail ?? undefined}>
              {userEmail}
            </span>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>
        <main className="flex-1 px-3 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
