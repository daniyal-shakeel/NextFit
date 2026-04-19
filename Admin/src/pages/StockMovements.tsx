import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, CloudDownload, Filter, RefreshCw, X } from "lucide-react";
import { adminAPI, type AdminUser, inventoryAPI, type InventoryStockMovement } from "@/lib/api";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ScrollTopBottomButtons } from "@/components/ScrollTopBottomButtons";
import { formatIsoDate } from "@/lib/formatIsoDate";
import { ADMIN_QUERY_STALE_MS } from "@/lib/queryClient";

const PAGE_SIZE = 40;
const adminStockMovementsKey = ["admin", "stock-movements"] as const;

type MovementFilters = {
  productId: string;
  productSearch: string;
  changedBy: string;
  dateFrom: string;
  dateTo: string;
};

function emptyFilters(): MovementFilters {
  return { productId: "", productSearch: "", changedBy: "", dateFrom: "", dateTo: "" };
}

function movementParams(f: MovementFilters) {
  return {
    productId: f.productId.trim() || undefined,
    productSearch: f.productSearch.trim() || undefined,
    changedBy: f.changedBy.trim() || undefined,
    dateFrom: f.dateFrom.trim() || undefined,
    dateTo: f.dateTo.trim() || undefined,
  };
}

export default function StockMovements() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullCatalogLoaded, setFullCatalogLoaded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<MovementFilters>(() => emptyFilters());
  const [draftFilters, setDraftFilters] = useState<MovementFilters>(appliedFilters);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const pid = searchParams.get("productId");
    if (pid) {
      setAppliedFilters((f) => ({ ...f, productId: pid }));
      setDraftFilters((f) => ({ ...f, productId: pid }));
    }
  }, [searchParams]);

  useEffect(() => {
    setSearchInput(appliedFilters.productSearch);
  }, [appliedFilters.productSearch]);

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

  const params = useMemo(() => movementParams(appliedFilters), [appliedFilters]);

  const movementsInfinite = useInfiniteQuery({
    queryKey: [...adminStockMovementsKey, "paginated", appliedFilters],
    enabled: Boolean(user) && !fullCatalogLoaded,
    initialPageParam: 0,
    staleTime: ADMIN_QUERY_STALE_MS,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const res = await inventoryAPI.movements({
        limit: PAGE_SIZE,
        skip: pageParam,
        ...params,
      });
      return res.data;
    },
    getNextPageParam: (last) => {
      if (!last.hasMore) return undefined;
      return last.skip + last.items.length;
    },
  });

  const movementsFull = useQuery({
    queryKey: [...adminStockMovementsKey, "full", appliedFilters],
    queryFn: async () => {
      const res = await inventoryAPI.movements({
        limit: 500,
        skip: 0,
        ...params,
      });
      return res.data;
    },
    enabled: Boolean(user) && fullCatalogLoaded,
    staleTime: ADMIN_QUERY_STALE_MS,
  });

  const rows = useMemo((): InventoryStockMovement[] => {
    if (fullCatalogLoaded && movementsFull.data) {
      return movementsFull.data.items ?? [];
    }
    return movementsInfinite.data?.pages.flatMap((p) => p.items ?? []) ?? [];
  }, [fullCatalogLoaded, movementsFull.data, movementsInfinite.data]);

  const lastPage = movementsInfinite.data?.pages[movementsInfinite.data.pages.length - 1];
  const total = fullCatalogLoaded
    ? (movementsFull.data?.total ?? rows.length)
    : (lastPage?.total ?? null);
  const hasMore = fullCatalogLoaded ? false : Boolean(lastPage?.hasMore);

  const loadingList = fullCatalogLoaded
    ? movementsFull.isLoading && !movementsFull.data
    : movementsInfinite.isLoading && !movementsInfinite.data;
  const loadingMore = movementsInfinite.isFetchingNextPage;
  const loadingForce = fullCatalogLoaded && movementsFull.isFetching;

  const listErr =
    (fullCatalogLoaded ? movementsFull.error : movementsInfinite.error) ?? null;
  const displayError =
    pageError ??
    (listErr instanceof Error ? listErr.message : listErr ? String(listErr) : null);

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: [...adminStockMovementsKey] });
  };

  const handleLoadMore = () => {
    if (fullCatalogLoaded || !hasMore || loadingMore) return;
    void movementsInfinite.fetchNextPage();
  };

  const openFilters = () => {
    setDraftFilters(appliedFilters);
    setFiltersOpen(true);
  };

  const applySidebarFilters = () => {
    setAppliedFilters(draftFilters);
    setFullCatalogLoaded(false);
    setFiltersOpen(false);
    setPageError(null);
    const pid = draftFilters.productId.trim();
    setSearchParams((p) => {
      if (pid) p.set("productId", pid);
      else p.delete("productId");
      return p;
    });
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (appliedFilters.productId.trim()) n += 1;
    if (appliedFilters.productSearch.trim()) n += 1;
    if (appliedFilters.changedBy.trim()) n += 1;
    if (appliedFilters.dateFrom.trim()) n += 1;
    if (appliedFilters.dateTo.trim()) n += 1;
    return n;
  }, [appliedFilters]);

  const refreshIconSpin = fullCatalogLoaded
    ? movementsFull.isFetching
    : Boolean(movementsInfinite.isFetching && !movementsInfinite.isFetchingNextPage);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Stock movement history" userEmail={user?.email}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            to="/inventory"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to inventory
          </Link>
        </div>

        <div className="sticky top-14 z-20 -mx-4 mb-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={loadingList && rows.length === 0}
                title="Refresh"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshIconSpin ? "animate-spin" : ""}`} aria-hidden />
              </button>
              <button
                type="button"
                onClick={openFilters}
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
            <form
              className="min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-64"
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchInput.trim();
                setAppliedFilters((f) => ({ ...f, productSearch: q }));
                setFullCatalogLoaded(false);
                setPageError(null);
              }}
            >
              <label htmlFor="sm-product-search" className="sr-only">
                Search by product name or slug
              </label>
              <input
                id="sm-product-search"
                name="productSearch"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                type="search"
                placeholder="Product name or slug…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="off"
              />
            </form>
            <button
              type="button"
              onClick={() => setFullCatalogLoaded(true)}
              disabled={loadingForce || loadingList}
              title="Load up to 500 matching rows at once"
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

        <p className="mb-4 text-xs text-muted-foreground">
          Filter by product, admin, or date range. Entries are recorded when stock is saved from the
          inventory screen.
        </p>

        {displayError && (
          <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {displayError}
          </div>
        )}

        {fullCatalogLoaded && movementsFull.data && (movementsFull.data.total ?? 0) > 500 ? (
          <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Showing the first 500 matching rows. Narrow filters to see specific changes.
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm ring-1 ring-border/40">
          {loadingList ? (
            <div className="p-8 text-center text-muted-foreground">Loading movements…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No stock changes match your filters.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        When
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Product
                      </th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Stock
                      </th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Threshold
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Changed by
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => (
                      <tr
                        key={m._id}
                        className="border-b border-border/80 transition-colors last:border-0 hover:bg-muted/25"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                          {formatIsoDate(m.createdAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-foreground">{m.productName}</div>
                          {m.productSlug ? (
                            <div className="text-xs text-muted-foreground">{m.productSlug}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-foreground">
                          {m.previousStock} → {m.newStock}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground">
                          {m.previousThreshold} → {m.newThreshold}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {m.changedByEmail ?? m.changedById ?? "—"}
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
                      Showing {rows.length} of {total} entries
                    </p>
                  ) : null}
                </div>
              ) : fullCatalogLoaded && total !== null ? (
                <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
                  Loaded {rows.length} of {total} matching entries
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
              <h2 className="text-lg font-semibold">Movement filters</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <label htmlFor="sm-pid" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Product ID (exact)
                </label>
                <input
                  id="sm-pid"
                  value={draftFilters.productId}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, productId: e.target.value }))}
                  placeholder="MongoDB ObjectId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="sm-changed" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Changed by (email or id)
                </label>
                <input
                  id="sm-changed"
                  value={draftFilters.changedBy}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, changedBy: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="sm-df" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Date from
                </label>
                <input
                  id="sm-df"
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="sm-dt" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Date to
                </label>
                <input
                  id="sm-dt"
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use the toolbar search for product name/slug. Combine with these filters to narrow
                results.
              </p>
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
                onClick={() => setDraftFilters(emptyFilters())}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Clear draft
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

      <ScrollTopBottomButtons />
    </AdminLayout>
  );
}
