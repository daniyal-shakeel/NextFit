import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CloudDownload,
  Filter,
  History,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import { adminAPI, type AdminUser, inventoryAPI, type InventoryItem } from "@/lib/api";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ScrollTopBottomButtons } from "@/components/ScrollTopBottomButtons";
import { ADMIN_QUERY_STALE_MS } from "@/lib/queryClient";

const PAGE_SIZE = 10;

const adminInventoryKey = ["admin", "inventory"] as const;

type StockFilter = "" | "low" | "out" | "healthy";

function emptyStockFilter(): StockFilter {
  return "";
}

function getCategoryName(categoryId: InventoryItem["categoryId"]): string {
  if (typeof categoryId === "object" && categoryId !== null && "name" in categoryId) {
    return (categoryId as { name: string }).name;
  }
  return typeof categoryId === "string" ? categoryId : "—";
}

function formatMoney(amount: number, currency: string) {
  const c = currency?.trim() || "PKR";
  if (Number.isNaN(Number(amount))) return `${c} —`;
  return `${c} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Inventory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dialogStyle, handleProps, reset: resetDrag } = useDraggableModal();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullCatalogLoaded, setFullCatalogLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appliedStockFilter, setAppliedStockFilter] = useState<StockFilter>(() => emptyStockFilter());
  const [draftStockFilter, setDraftStockFilter] = useState<StockFilter>(appliedStockFilter);

  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editStock, setEditStock] = useState("");
  const [editThreshold, setEditThreshold] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

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

  const analyticsQuery = useQuery({
    queryKey: [...adminInventoryKey, "analytics"],
    queryFn: async () => {
      const res = await inventoryAPI.analytics();
      return res.data;
    },
    enabled: Boolean(user),
    staleTime: ADMIN_QUERY_STALE_MS,
  });

  const inventoryInfinite = useInfiniteQuery({
    queryKey: [...adminInventoryKey, "paginated", appliedStockFilter, appliedSearch],
    enabled: Boolean(user) && !fullCatalogLoaded,
    initialPageParam: 0,
    staleTime: ADMIN_QUERY_STALE_MS,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const res = await inventoryAPI.list({
        limit: PAGE_SIZE,
        skip: pageParam,
        stockFilter: appliedStockFilter || undefined,
        search: appliedSearch.trim() || undefined,
      });
      return res.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((sum, p) => sum + (p.items?.length ?? 0), 0);
    },
  });

  const inventoryFull = useQuery({
    queryKey: [...adminInventoryKey, "full", appliedStockFilter, appliedSearch],
    queryFn: async () => {
      const res = await inventoryAPI.list({
        stockFilter: appliedStockFilter || undefined,
        search: appliedSearch.trim() || undefined,
      });
      return res.data;
    },
    enabled: Boolean(user) && fullCatalogLoaded,
    staleTime: ADMIN_QUERY_STALE_MS,
  });

  const items = useMemo((): InventoryItem[] => {
    if (fullCatalogLoaded && inventoryFull.data) {
      return inventoryFull.data.items ?? [];
    }
    return inventoryInfinite.data?.pages.flatMap((p) => p.items ?? []) ?? [];
  }, [fullCatalogLoaded, inventoryFull.data, inventoryInfinite.data]);

  const lastInfinitePage =
    inventoryInfinite.data?.pages[inventoryInfinite.data.pages.length - 1];
  const total = fullCatalogLoaded
    ? (inventoryFull.data?.total ?? items.length)
    : (lastInfinitePage?.total ?? null);
  const hasMore = fullCatalogLoaded ? false : Boolean(lastInfinitePage?.hasMore);

  const loadingList = fullCatalogLoaded
    ? inventoryFull.isLoading && !inventoryFull.data
    : inventoryInfinite.isLoading && !inventoryInfinite.data;
  const loadingMore = inventoryInfinite.isFetchingNextPage;
  const loadingForce = fullCatalogLoaded && inventoryFull.isFetching;

  const listErr =
    (fullCatalogLoaded ? inventoryFull.error : inventoryInfinite.error) ??
    analyticsQuery.error;
  const displayError =
    pageError ??
    (listErr instanceof Error ? listErr.message : listErr ? String(listErr) : null);

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: [...adminInventoryKey] });
  };

  const handleLoadMore = () => {
    if (fullCatalogLoaded || !hasMore || loadingMore) return;
    void inventoryInfinite.fetchNextPage();
  };

  const openFilters = () => {
    setDraftStockFilter(appliedStockFilter);
    setFiltersOpen(true);
  };

  const applySidebarFilters = () => {
    setAppliedStockFilter(draftStockFilter);
    setFullCatalogLoaded(false);
    setFiltersOpen(false);
  };

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setAppliedSearch(q);
    setFullCatalogLoaded(false);
  };

  const openEdit = (item: InventoryItem) => {
    setSelected(item);
    setEditStock(String(item.stockQuantity));
    setEditThreshold(String(item.lowStockThreshold));
    setSaveError(null);
    resetDrag();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    const stock = parseInt(editStock, 10);
    const threshold = parseInt(editThreshold, 10);
    if (Number.isNaN(stock) || stock < 0) {
      setSaveError("Stock must be a non-negative number");
      return;
    }
    if (Number.isNaN(threshold) || threshold < 0) {
      setSaveError("Low stock threshold must be a non-negative number");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await inventoryAPI.updateStock(String(selected.id), {
        stockQuantity: stock,
        lowStockThreshold: threshold,
      });
      setPageError(null);
      closeModal();
      void queryClient.invalidateQueries({ queryKey: [...adminInventoryKey] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "stock-movements"] });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  const activeFilterCount = appliedStockFilter ? 1 : 0;

  const refreshIconSpin = fullCatalogLoaded
    ? inventoryFull.isFetching
    : Boolean(inventoryInfinite.isFetching && !inventoryInfinite.isFetchingNextPage);

  const analytics = analyticsQuery.data;
  const showSearchNoMatches =
    appliedSearch.trim().length > 0 &&
    items.length === 0 &&
    !loadingList &&
    !fullCatalogLoaded &&
    hasMore;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Inventory" userEmail={user?.email}>
      <div className="mx-auto max-w-6xl">
        <div className="sticky top-14 z-20 -mx-4 mb-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={loadingList && items.length === 0}
                title="Refresh inventory data"
                aria-label="Refresh inventory"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshIconSpin ? "animate-spin" : ""}`} aria-hidden />
              </button>
              <button
                type="button"
                onClick={openFilters}
                title="Filters"
                className={`relative flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 ${
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
            <form onSubmit={applySearch} className="min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-64">
              <label htmlFor="inv-search" className="sr-only">
                Search products
              </label>
              <input
                id="inv-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or slug…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="off"
              />
            </form>
            <button
              type="button"
              onClick={() => setFullCatalogLoaded(true)}
              disabled={loadingForce || loadingList}
              title="Load all rows matching filters (may be slower)"
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
          Metrics and stock history use live product and order data. Stock movements are recorded when
          you save changes here.
        </p>

        {displayError && (
          <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {displayError}
          </div>
        )}

        {showSearchNoMatches && (
          <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            No match in loaded rows. Try &quot;Load more&quot; or force-load all.
          </div>
        )}

        {analyticsQuery.isLoading && !analytics ? (
          <div className="mb-6 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            Loading analytics…
          </div>
        ) : analytics ? (
          <div className="mb-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total SKUs
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{analytics.totalSkuCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">Products in catalog</p>
              </div>
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Low stock alerts
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-800 dark:text-amber-200">
                  {analytics.lowStockAlertsCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Stock ≤ threshold (threshold &gt; 0)</p>
              </div>
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Out of stock
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-destructive">
                  {analytics.outOfStockCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Quantity = 0</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  In stock (healthy)
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {analytics.inStockHealthyCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Above threshold or in-stock with no threshold</p>
              </div>
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-sm sm:col-span-2 lg:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total inventory value
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {formatMoney(analytics.totalInventoryValue, analytics.currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Σ (stock × base price)</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Most stocked
                </h3>
                {analytics.mostStocked ? (
                  <p className="mt-2 text-sm">
                    <span className="font-medium text-foreground">{analytics.mostStocked.name}</span>
                    <span className="text-muted-foreground"> — </span>
                    <span className="tabular-nums font-semibold">{analytics.mostStocked.stockQuantity} units</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Least stocked
                </h3>
                {analytics.leastStocked ? (
                  <p className="mt-2 text-sm">
                    <span className="font-medium text-foreground">{analytics.leastStocked.name}</span>
                    <span className="text-muted-foreground"> — </span>
                    <span className="tabular-nums font-semibold">{analytics.leastStocked.stockQuantity} units</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">—</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category stock breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Category</th>
                      <th className="py-2 pr-4 font-medium">SKUs</th>
                      <th className="py-2 font-medium">Total units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.categoryBreakdown.map((c) => (
                      <tr key={c.categoryId} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-4">{c.categoryName}</td>
                        <td className="py-2 pr-4 tabular-nums">{c.skuCount}</td>
                        <td className="py-2 tabular-nums">{c.totalUnits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Top selling (units on non-cancelled orders)
                </h3>
                <ul className="space-y-2 text-sm">
                  {analytics.topSelling.map((p) => (
                    <li key={p.productId} className="flex justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{p.unitsSold} sold</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Slow moving (lowest units sold)
                </h3>
                <ul className="space-y-2 text-sm">
                  {analytics.slowMoving.map((p) => (
                    <li key={p.productId} className="flex justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{p.unitsSold} sold</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dead stock (≥10 units, no sales)
                </h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  No line items on non-cancelled / non-refunded orders.
                </p>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {analytics.deadStock.length === 0 ? (
                    <li className="text-muted-foreground">None</li>
                  ) : (
                    analytics.deadStock.map((p) => (
                      <li key={p.productId} className="flex justify-between gap-2">
                        <span>{p.name}</span>
                        <span className="tabular-nums text-muted-foreground">{p.stockQuantity} on hand</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Restock frequency (admin increases)
                </h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  Count of saves where new stock was higher than before.
                </p>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {analytics.restockFrequency.length === 0 ? (
                    <li className="text-muted-foreground">No history yet</li>
                  ) : (
                    analytics.restockFrequency.map((p) => (
                      <li key={p.productId} className="flex justify-between gap-2">
                        <span>{p.name}</span>
                        <span className="tabular-nums text-muted-foreground">{p.restockCount}×</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <section className="mb-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Stock movement history</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse every stock change with filters, dates, and admin attribution on a dedicated page.
            </p>
          </div>
          <Link
            to="/inventory/movements"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <History className="h-4 w-4" aria-hidden />
            Open stock history
          </Link>
        </section>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm ring-1 ring-border/40">
          {loadingList ? (
            <div className="p-8 text-center text-muted-foreground">Loading inventory…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No products match.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Product
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Category
                      </th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Stock
                      </th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Low at
                      </th>
                      <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={String(item.id)}
                        className="border-b border-border/80 transition-colors last:border-0 hover:bg-muted/25"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.slug}</div>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{getCategoryName(item.categoryId)}</td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums">{item.stockQuantity}</td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums">{item.lowStockThreshold}</td>
                        <td className="px-4 py-3.5 text-center">
                          {item.stockQuantity === 0 ? (
                            <span className="inline-flex rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                              Out of stock
                            </span>
                          ) : item.isLowStock ? (
                            <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                              Low stock
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                              In stock
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Link
                              to={`/inventory/movements?productId=${encodeURIComponent(String(item.id))}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <History className="h-3.5 w-3.5" />
                              History
                            </Link>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/60 px-2.5 py-2 text-xs font-medium hover:bg-muted"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
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
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                  {total !== null ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing {items.length} of {total} products
                    </p>
                  ) : null}
                </div>
              ) : fullCatalogLoaded && total !== null ? (
                <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
                  All {total} products loaded
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {filtersOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 dark:bg-black/50"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-lg font-semibold">Inventory filters</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              <div>
                <label htmlFor="inv-stock-filter" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Stock status
                </label>
                <select
                  id="inv-stock-filter"
                  value={draftStockFilter}
                  onChange={(e) => setDraftStockFilter(e.target.value as StockFilter)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All</option>
                  <option value="low">Low (≤ threshold)</option>
                  <option value="out">Out (0)</option>
                  <option value="healthy">Healthy (above threshold)</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setDraftStockFilter("")}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applySidebarFilters}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Apply filters
              </button>
            </div>
          </aside>
        </>
      )}

      {modalOpen && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-modal-title"
        >
          <div
            className="bg-card rounded-lg shadow-lg border border-border w-full max-w-md mx-4 p-6"
            style={dialogStyle}
          >
            <h2
              {...handleProps}
              id="inventory-modal-title"
              className="text-lg font-semibold mb-4 cursor-grab active:cursor-grabbing select-none touch-none"
            >
              Update stock — {selected.name}
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="inv-stock" className="block text-sm font-medium mb-1">
                  Stock quantity
                </label>
                <input
                  id="inv-stock"
                  type="number"
                  min={0}
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="inv-threshold" className="block text-sm font-medium mb-1">
                  Low stock threshold (alert when stock ≤ this)
                </label>
                <input
                  id="inv-threshold"
                  type="number"
                  min={0}
                  value={editThreshold}
                  onChange={(e) => setEditThreshold(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            {saveError && <p className="mt-2 text-sm text-destructive">{saveError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ScrollTopBottomButtons />
    </AdminLayout>
  );
}
