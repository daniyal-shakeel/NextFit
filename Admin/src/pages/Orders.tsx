import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CloudDownload, Eye, Filter, RefreshCw, X } from "lucide-react";
import { adminAPI, type AdminUser } from "@/lib/api";
import {
  ordersAPI,
  ORDER_STATUSES,
  orderCustomerName,
  orderUserDisplayId,
  type OrderItem,
} from "@/lib/api";
import { formatIsoDate } from "@/lib/formatIsoDate";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ScrollTopBottomButtons } from "@/components/ScrollTopBottomButtons";
import { ADMIN_QUERY_STALE_MS } from "@/lib/queryClient";

const PAGE_SIZE = 10;

const adminOrdersKey = ["admin", "orders"] as const;

type OrderFilters = {
  userId: string;
  statuses: string[];
  dateFrom: string;
  dateTo: string;
};

function emptyFilters(): OrderFilters {
  return { userId: "", statuses: [], dateFrom: "", dateTo: "" };
}

function formatMoney(amount: number | undefined, currency: string | undefined): string {
  const c = currency?.trim() || "PKR";
  if (amount === undefined || Number.isNaN(Number(amount))) return `${c} —`;
  const n = Number(amount);
  return `${c} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function orderMatchesSearch(o: OrderItem, q: string): boolean {
  const qq = q.trim().toLowerCase();
  if (!qq) return true;
  if ((o.orderNumber ?? "").toLowerCase().includes(qq)) return true;
  if (o._id.toLowerCase().includes(qq)) return true;
  if (String(o.status).toLowerCase().includes(qq)) return true;
  const cust = orderUserDisplayId(o.userId).toLowerCase();
  if (cust.includes(qq)) return true;
  const cname = orderCustomerName(o.userId).toLowerCase();
  if (cname.includes(qq)) return true;
  if (o.shippingAddress) {
    const ship = o.shippingAddress;
    const parts = [
      ship.firstName,
      ship.lastName,
      ship.email,
      ship.phone,
      ship.street,
      ship.city,
      ship.province,
      ship.zipCode,
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    if (parts.some((p) => p.includes(qq))) return true;
  }
  if (typeof o.userId === "object" && o.userId !== null) {
    const u = o.userId as { name?: string; email?: string; googleEmail?: string };
    if ((u.name ?? "").toLowerCase().includes(qq)) return true;
    if ((u.email ?? "").toLowerCase().includes(qq)) return true;
    if ((u.googleEmail ?? "").toLowerCase().includes(qq)) return true;
  }
  const uidObj =
    typeof o.userId === "object" && o.userId !== null && "_id" in o.userId
      ? String((o.userId as { _id?: string })._id ?? "").toLowerCase()
      : "";
  if (uidObj.includes(qq)) return true;
  for (const line of o.lineItems ?? []) {
    if (line.name.toLowerCase().includes(qq)) return true;
    if (String(line.productId).toLowerCase().includes(qq)) return true;
  }
  return false;
}

function shippingLabel(o: OrderItem): { primary: string; secondary?: string } | null {
  const s = o.shippingAddress;
  if (!s) return null;
  const name = [s.firstName, s.lastName].filter(Boolean).join(" ").trim();
  const phone = (s.phone ?? "").trim();
  const email = (s.email ?? "").trim();
  const primary = name || phone || email;
  if (!primary) return null;
  const secondary = phone && phone !== primary ? phone : email && email !== primary ? email : undefined;
  return { primary, secondary };
}

function formatTableDate(s: string | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function orderStatusTone(status: string): string {
  const s = String(status).toLowerCase();
  if (s === "delivered") return "text-emerald-600 dark:text-emerald-400";
  if (s === "shipped" || s === "confirmed" || s === "processing")
    return "text-sky-600 dark:text-sky-400";
  if (s === "pending") return "text-amber-600 dark:text-amber-400";
  if (s === "cancelled" || s === "refunded" || s === "partially_refunded")
    return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

export default function Orders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullCatalogLoaded, setFullCatalogLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<OrderFilters>(() => ({
    ...emptyFilters(),
    userId: searchParams.get("userId") ?? "",
  }));
  const [draftFilters, setDraftFilters] = useState<OrderFilters>(appliedFilters);
  const [selected, setSelected] = useState<OrderItem | null>(null);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);
  const orderDetailRef = useRef<HTMLElement | null>(null);
  const [statusEdit, setStatusEdit] = useState<string>("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    adminAPI
      .checkAuth()
      .then((res) => {
        if (res.authenticated && res.data?.user?.isAdmin) {
          setUser(res.data.user);
        } else {
          navigate("/login", { replace: true });
        }
      })
      .catch(() => navigate("/login", { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    const u = searchParams.get("userId") ?? "";
    setAppliedFilters((prev) => ({ ...prev, userId: u }));
    setDraftFilters((prev) => ({ ...prev, userId: u }));
  }, [searchParams]);

  const filterKey = [
    appliedFilters.userId,
    appliedFilters.statuses.join(","),
    appliedFilters.dateFrom,
    appliedFilters.dateTo,
  ] as const;

  const ordersInfinite = useInfiniteQuery({
    queryKey: [...adminOrdersKey, "paginated", ...filterKey],
    enabled: Boolean(user) && !fullCatalogLoaded,
    initialPageParam: 0,
    staleTime: ADMIN_QUERY_STALE_MS,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const res = await ordersAPI.list(
        listQuery(appliedFilters, { limit: PAGE_SIZE, skip: pageParam })
      );
      return res.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const loaded = allPages.reduce((sum, p) => sum + (p.items?.length ?? 0), 0);
      return loaded;
    },
  });

  const ordersFull = useQuery({
    queryKey: [...adminOrdersKey, "full", ...filterKey],
    queryFn: async () => {
      const res = await ordersAPI.list(listQuery(appliedFilters, {}));
      return res.data;
    },
    enabled: Boolean(user) && fullCatalogLoaded,
    staleTime: ADMIN_QUERY_STALE_MS,
  });

  const items = useMemo((): OrderItem[] => {
    if (fullCatalogLoaded && ordersFull.data) {
      return ordersFull.data.items ?? [];
    }
    return ordersInfinite.data?.pages.flatMap((p) => p.items ?? []) ?? [];
  }, [fullCatalogLoaded, ordersFull.data, ordersInfinite.data]);

  const lastInfinitePage =
    ordersInfinite.data?.pages[ordersInfinite.data.pages.length - 1];
  const total = fullCatalogLoaded
    ? (ordersFull.data?.total ?? items.length)
    : (lastInfinitePage?.total ?? null);
  const hasMore = fullCatalogLoaded ? false : Boolean(lastInfinitePage?.hasMore);

  const loadingList = fullCatalogLoaded
    ? ordersFull.isLoading && !ordersFull.data
    : ordersInfinite.isLoading && !ordersInfinite.data;
  const loadingMore = ordersInfinite.isFetchingNextPage;
  const loadingForce = fullCatalogLoaded && ordersFull.isFetching;

  const listFetchError =
    (fullCatalogLoaded ? ordersFull.error : ordersInfinite.error) ?? null;
  const displayError =
    listFetchError instanceof Error
      ? listFetchError.message
      : listFetchError
        ? String(listFetchError)
        : null;

  const handleLoadMore = () => {
    if (fullCatalogLoaded || !hasMore || loadingMore) return;
    void ordersInfinite.fetchNextPage();
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: [...adminOrdersKey] });
  };

  const refreshIconSpin = fullCatalogLoaded
    ? ordersFull.isFetching
    : Boolean(ordersInfinite.isFetching && !ordersInfinite.isFetchingNextPage);

  const openFilters = () => {
    setDraftFilters(appliedFilters);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setFullCatalogLoaded(false);
    setFiltersOpen(false);
  };

  const resetDraftFilters = () => {
    setDraftFilters(emptyFilters());
  };

  const toggleDraftStatus = (s: string) => {
    setDraftFilters((prev) => {
      const has = prev.statuses.includes(s);
      const statuses = has ? prev.statuses.filter((x) => x !== s) : [...prev.statuses, s];
      return { ...prev, statuses };
    });
  };

  const openView = (order: OrderItem) => {
    setSelected(order);
    setStatusEdit(order.status);
    setStatusError(null);
    setOrderDetailVisible(true);
    requestAnimationFrame(() => {
      orderDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleUpdateStatus = async () => {
    if (!selected || statusEdit === selected.status) return;
    setUpdatingStatus(true);
    setStatusError(null);
    try {
      const res = await ordersAPI.updateStatus(selected._id, statusEdit);
      setSelected(res.data);
      void queryClient.invalidateQueries({ queryKey: [...adminOrdersKey] });
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return items;
    return items.filter((o) => orderMatchesSearch(o, q));
  }, [items, searchQuery]);

  const showSearchNoMatches =
    searchQuery.trim().length > 0 &&
    filteredItems.length === 0 &&
    items.length > 0 &&
    !fullCatalogLoaded &&
    hasMore;

  const activeFilterCount =
    (appliedFilters.userId.trim() ? 1 : 0) +
    appliedFilters.statuses.length +
    (appliedFilters.dateFrom.trim() ? 1 : 0) +
    (appliedFilters.dateTo.trim() ? 1 : 0);

  const selectedCurrency = selected?.currency ?? "PKR";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Orders" userEmail={user?.email}>
      <div className="mx-auto max-w-6xl">
        <div className="sticky top-14 z-20 -mx-4 mb-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={loadingList && items.length === 0}
                title="Fetch latest from database"
                aria-label="Fetch latest orders from database"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800/70"
              >
                <RefreshCw className={`h-4 w-4 ${refreshIconSpin ? "animate-spin" : ""}`} aria-hidden />
              </button>
              <button
                type="button"
                onClick={openFilters}
                title="Filters"
                aria-label="Open order filters"
                className={`relative flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  activeFilterCount > 0 ? "border-primary/40 bg-primary/5" : ""
                }`}
              >
                <Filter className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
            <div className="min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-64">
              <label htmlFor="order-search" className="sr-only">
                Search loaded orders
              </label>
              <input
                id="order-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order #, customer name, ID, status, products…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={() => setFullCatalogLoaded(true)}
              disabled={loadingForce || loadingList}
              title="Force load all orders from database matching current filters (may take longer)"
              aria-label={loadingForce ? "Loading all orders" : "Force load all orders from database"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-card text-amber-700 hover:bg-amber-500/10 dark:text-amber-300 disabled:opacity-50"
            >
              {loadingForce ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CloudDownload className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <p className="mb-4 text-xs text-amber-700 dark:text-amber-200/90">
          Force load fetches every matching order at once and may take longer on large datasets. Use
          filters to narrow results first.
        </p>

        {displayError && (
          <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {displayError}
          </div>
        )}

        {showSearchNoMatches && (
          <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            No match in the orders currently loaded. Try &quot;Load more orders&quot; — the order
            you want may appear after loading more.
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm ring-1 ring-border/40">
          {loadingList ? (
            <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No orders found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Order number
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Customer
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Total
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Created
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((o) => (
                      <tr
                        key={o._id}
                        className="border-b border-border/80 last:border-0 transition-colors hover:bg-muted/25"
                      >
                        <td className="px-4 py-3.5 align-top font-mono text-xs text-muted-foreground">
                          {o.orderNumber ?? o._id}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <div className="font-semibold text-foreground">{orderCustomerName(o.userId)}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {orderUserDisplayId(o.userId)}
                          </div>
                          {o.userId == null ? (
                            shippingLabel(o) ? (
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {shippingLabel(o)!.primary}
                                {shippingLabel(o)!.secondary ? ` · ${shippingLabel(o)!.secondary}` : ""}
                              </div>
                            ) : (
                              <div className="mt-1 text-[11px] text-muted-foreground">Guest checkout</div>
                            )
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <span
                            className={`inline-block font-medium capitalize ${orderStatusTone(o.status)}`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-top font-medium tabular-nums text-foreground">
                          {formatMoney(o.total, o.currency)}
                        </td>
                        <td className="px-4 py-3.5 align-top text-muted-foreground">
                          {formatTableDate(o.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex w-full min-w-[6.5rem] flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => openView(o)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted"
                            >
                              <Eye className="h-3.5 w-3.5 shrink-0" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!fullCatalogLoaded && hasMore ? (
                <div className="border-t border-border p-4 text-center">
                  <button
                    type="button"
                    onClick={() => void handleLoadMore()}
                    disabled={loadingMore}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : "Load more orders"}
                  </button>
                  {total !== null ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing {items.length} of {total} orders
                    </p>
                  ) : null}
                </div>
              ) : fullCatalogLoaded && total !== null ? (
                <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
                  All {total} orders loaded
                </div>
              ) : null}
            </>
          )}
        </div>

        {orderDetailVisible && selected ? (
          <section
            ref={orderDetailRef}
            className="mt-8 scroll-mt-20 rounded-2xl border border-border bg-card shadow-sm ring-1 ring-border/40"
            aria-labelledby="order-detail-heading"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6 lg:px-8">
              <h2 id="order-detail-heading" className="text-lg font-semibold tracking-tight text-foreground">
                Order details
              </h2>
              <button
                type="button"
                onClick={() => setOrderDetailVisible(false)}
                className="rounded-lg border border-primary/35 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15"
              >
                Hide details
              </button>
            </header>

            <article className="p-5 sm:p-6 lg:p-8">
              <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted/40 via-card to-card p-5 sm:p-6 lg:flex lg:items-start lg:justify-between lg:gap-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/5 blur-3xl" aria-hidden />
                <div className="relative min-w-0 flex-1 space-y-4">
                  <h3 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
                    {selected.orderNumber ?? selected._id}
                  </h3>
                  <div className="flex flex-wrap gap-2" aria-label="Order identifiers">
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 font-mono text-[11px] shadow-sm backdrop-blur-sm sm:text-xs">
                      <span className="shrink-0 text-muted-foreground/70">Display</span>
                      <span className="truncate text-foreground">{selected.orderNumber ?? "—"}</span>
                    </span>
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 font-mono text-[11px] shadow-sm backdrop-blur-sm sm:text-xs">
                      <span className="shrink-0 text-muted-foreground/70">Order id</span>
                      <span className="truncate text-muted-foreground">{selected._id}</span>
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Created
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-foreground sm:text-sm">
                        <time dateTime={selected.createdAt}>{formatIsoDate(selected.createdAt)}</time>
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Updated
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-foreground sm:text-sm">
                        <time dateTime={selected.updatedAt}>{formatIsoDate(selected.updatedAt)}</time>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="relative mt-6 flex shrink-0 flex-col items-stretch gap-3 sm:items-end lg:mt-0">
                  <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3 text-right shadow-sm backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Order total
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
                      {formatMoney(selected.total, selectedCurrency)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center justify-center rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold capitalize shadow-sm sm:self-end ${orderStatusTone(selected.status)}`}
                  >
                    {selected.status}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-8">
                <div className="space-y-6 lg:col-span-7">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <section
                      className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                      aria-labelledby="order-customer-label"
                    >
                      <h4
                        id="order-customer-label"
                        className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Customer
                      </h4>
                      <p className="text-base font-semibold text-foreground">
                        {orderCustomerName(selected.userId)}
                      </p>
                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Customer ID</dt>
                          <dd className="mt-0.5 font-mono text-xs font-medium text-foreground">
                            {orderUserDisplayId(selected.userId)}
                          </dd>
                        </div>
                        {selected.userId == null && selected.shippingAddress ? (
                          <>
                            {[selected.shippingAddress.firstName, selected.shippingAddress.lastName].filter(Boolean).join(" ").trim() ? (
                              <div>
                                <dt className="text-xs text-muted-foreground">Guest name</dt>
                                <dd className="mt-0.5 break-all font-medium">
                                  {[selected.shippingAddress.firstName, selected.shippingAddress.lastName].filter(Boolean).join(" ").trim()}
                                </dd>
                              </div>
                            ) : null}
                            {selected.shippingAddress.phone ? (
                              <div>
                                <dt className="text-xs text-muted-foreground">Guest phone</dt>
                                <dd className="mt-0.5 break-all font-medium">
                                  {selected.shippingAddress.phone}
                                </dd>
                              </div>
                            ) : null}
                            {selected.shippingAddress.email ? (
                              <div>
                                <dt className="text-xs text-muted-foreground">Guest email</dt>
                                <dd className="mt-0.5 break-all font-medium">
                                  {selected.shippingAddress.email}
                                </dd>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {typeof selected.userId === "object" && selected.userId !== null ? (
                          <>
                            {(selected.userId as { email?: string }).email ? (
                              <div>
                                <dt className="text-xs text-muted-foreground">Email</dt>
                                <dd className="mt-0.5 break-all font-medium">
                                  {(selected.userId as { email: string }).email}
                                </dd>
                              </div>
                            ) : null}
                            {(selected.userId as { googleEmail?: string }).googleEmail ? (
                              <div>
                                <dt className="text-xs text-muted-foreground">Google email</dt>
                                <dd className="mt-0.5 break-all font-medium">
                                  {(selected.userId as { googleEmail: string }).googleEmail}
                                </dd>
                              </div>
                            ) : null}
                            <div>
                              <dt className="text-xs text-muted-foreground">User id</dt>
                              <dd className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                                {String((selected.userId as { _id?: string })._id ?? "—")}
                              </dd>
                            </div>
                          </>
                        ) : null}
                      </dl>
                    </section>

                    <section
                      className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                      aria-labelledby="order-status-label"
                    >
                      <h4
                        id="order-status-label"
                        className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Order status
                      </h4>
                      <div className="flex flex-1 flex-col gap-3">
                        <select
                          value={statusEdit}
                          onChange={(e) => setStatusEdit(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleUpdateStatus}
                          disabled={updatingStatus || statusEdit === selected.status}
                          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {updatingStatus ? "Updating…" : "Update status"}
                        </button>
                      </div>
                      {statusError ? (
                        <p className="mt-3 border-t border-border/60 pt-3 text-sm text-destructive">
                          {statusError}
                        </p>
                      ) : null}
                    </section>
                  </div>

                  <section
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                    aria-labelledby="order-money-label"
                  >
                    <h4
                      id="order-money-label"
                      className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Amounts
                    </h4>
                    <dl className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/50 bg-muted/5 p-3">
                        <dt className="text-xs text-muted-foreground">Subtotal</dt>
                        <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                          {formatMoney(selected.subtotal, selectedCurrency)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/5 p-3">
                        <dt className="text-xs text-muted-foreground">Discount</dt>
                        <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                          {formatMoney(selected.discountAmount, selectedCurrency)}
                          {selected.discountCode ? (
                            <span className="ml-1 block text-xs font-normal text-muted-foreground">
                              ({selected.discountCode})
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:col-span-1">
                        <dt className="text-xs font-medium text-muted-foreground">Order total</dt>
                        <dd className="mt-1 text-lg font-bold tabular-nums text-foreground">
                          {formatMoney(selected.total, selectedCurrency)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                    aria-labelledby="order-transactions-label"
                  >
                    <h4
                      id="order-transactions-label"
                      className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Transaction IDs
                    </h4>
                    {(selected.transactionIds?.length ?? 0) === 0 ? (
                      <p className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
                        None recorded
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm font-mono">
                        {selected.transactionIds!.map((tid) => (
                          <li
                            key={tid}
                            className="break-all rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs"
                          >
                            {tid}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>

                <div className="lg:col-span-5">
                  <section
                    className="sticky top-20 rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                    aria-labelledby="order-line-items-label"
                  >
                    <h4
                      id="order-line-items-label"
                      className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Line items
                    </h4>
                    {(selected.lineItems ?? []).length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                        No line items
                      </p>
                    ) : (
                      <ul className="grid max-h-[min(70vh,36rem)] gap-3 overflow-y-auto pr-1">
                        {(selected.lineItems ?? []).map((line, i) => (
                          <li
                            key={`${String(line.productId)}-${i}`}
                            className="rounded-xl border border-border/70 bg-muted/5 p-3.5 shadow-sm transition-colors hover:bg-muted/10"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground">{line.name}</p>
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                  Qty <span className="font-medium text-foreground">{line.quantity}</span>
                                  <span className="mx-1.5 text-border">·</span>
                                  <span className="font-mono text-[11px]">
                                    {String(line.productId)}
                                  </span>
                                </p>
                              </div>
                              <div className="shrink-0 text-right text-sm tabular-nums">
                                <p className="text-xs text-muted-foreground">
                                  {formatMoney(line.priceAtOrder, selectedCurrency)} each
                                </p>
                                <p className="mt-0.5 font-semibold text-foreground">
                                  {formatMoney(line.subtotal, selectedCurrency)}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {selected.shippingAddress ? (
                    <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5">
                      <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Shipping (snapshot)
                      </h4>
                      <dl className="grid gap-3 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Recipient</dt>
                          <dd className="mt-0.5 font-medium text-foreground">
                            {[selected.shippingAddress.firstName, selected.shippingAddress.lastName].filter(Boolean).join(" ").trim() || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Phone</dt>
                          <dd className="mt-0.5 font-medium text-foreground">{selected.shippingAddress.phone ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Email</dt>
                          <dd className="mt-0.5 break-all font-medium text-foreground">{selected.shippingAddress.email ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Address</dt>
                          <dd className="mt-0.5 font-medium text-foreground">
                            {[
                              selected.shippingAddress.street,
                              selected.shippingAddress.city,
                              selected.shippingAddress.province,
                              selected.shippingAddress.zipCode,
                            ]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  ) : null}
                </div>
              </div>
            </article>
          </section>
        ) : null}
      </div>

      {filtersOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 dark:bg-black/50"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-xl"
            aria-labelledby="orders-filters-heading"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id="orders-filters-heading" className="text-lg font-semibold">
                Order filters
              </h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              <div>
                <label htmlFor="filter-user-id" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Customer / user ID
                </label>
                <input
                  id="filter-user-id"
                  type="text"
                  value={draftFilters.userId}
                  onChange={(e) => setDraftFilters((p) => ({ ...p, userId: e.target.value }))}
                  placeholder="MongoDB id or CUS-…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-medium text-muted-foreground">Status</legend>
                <p className="text-[11px] text-muted-foreground">Select one or more; leave empty for any.</p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                  {ORDER_STATUSES.map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draftFilters.statuses.includes(s)}
                        onChange={() => toggleDraftStatus(s)}
                        className="rounded border-input"
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="filter-from" className="mb-1 block text-xs font-medium text-muted-foreground">
                    From date
                  </label>
                  <input
                    id="filter-from"
                    type="date"
                    value={draftFilters.dateFrom}
                    onChange={(e) => setDraftFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="filter-to" className="mb-1 block text-xs font-medium text-muted-foreground">
                    To date
                  </label>
                  <input
                    id="filter-to"
                    type="date"
                    value={draftFilters.dateTo}
                    onChange={(e) => setDraftFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-border p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={resetDraftFilters}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Clear draft
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Apply filters
              </button>
            </div>
          </aside>
        </>
      )}

      <ScrollTopBottomButtons />
    </AdminLayout>
  );
}

function listQuery(applied: OrderFilters, paginated: { limit?: number; skip?: number }) {
  const p: Parameters<typeof ordersAPI.list>[0] = { ...paginated };
  const uid = applied.userId.trim();
  if (uid) p.userId = uid;
  if (applied.statuses.length) p.status = applied.statuses;
  const df = applied.dateFrom.trim();
  const dt = applied.dateTo.trim();
  if (df) p.dateFrom = df;
  if (dt) p.dateTo = dt;
  return p;
}
