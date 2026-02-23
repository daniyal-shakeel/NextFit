import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, RefreshCw } from "lucide-react";
import { adminAPI, type AdminUser } from "@/lib/api";
import { ordersAPI, ORDER_STATUSES, orderUserDisplayId, type OrderItem } from "@/lib/api";

function formatDate(s: string | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userIdFromUrl = searchParams.get("userId") ?? "";
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<OrderItem | null>(null);
  const [modal, setModal] = useState<"view" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userIdFilter, setUserIdFilter] = useState(() => searchParams.get("userId") ?? "");
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

  const fetchOrders = async (p = page) => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await ordersAPI.list({
        page: p,
        limit: 10,
        userId: userIdFilter.trim() || undefined,
      });
      setItems(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
      setPage(res.data.page ?? 1);
      setTotalPages(res.data.totalPages ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const u = searchParams.get("userId") ?? "";
    setUserIdFilter(u);
  }, [searchParams]);

  useEffect(() => {
    if (user) fetchOrders(page);
  }, [user, page, userIdFilter]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders(1);
  };

  const openView = async (order: OrderItem) => {
    setSelected(order);
    setStatusEdit(order.status);
    setStatusError(null);
    setModal("view");
  };

  const handleUpdateStatus = async () => {
    if (!selected || statusEdit === selected.status) return;
    setUpdatingStatus(true);
    setStatusError(null);
    try {
      const res = await ordersAPI.updateStatus(selected._id, statusEdit);
      setSelected(res.data);
      setItems((prev) =>
        prev.map((o) => (o._id === selected._id ? { ...o, status: res.data.status } : o))
      );
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-serif font-bold">Orders</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <form onSubmit={handleFilter} className="flex gap-2 flex-1">
            <input
              type="text"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              placeholder="Filter by Customer ID or User ID..."
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              Filter
            </button>
          </form>
          <button
            type="button"
            onClick={() => fetchOrders(page)}
            disabled={loadingList}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loadingList && items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No orders found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Order number</th>
                    <th className="text-left p-3 font-medium">Customer ID</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Total</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <tr key={o._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{o.orderNumber ?? o._id}</td>
                      <td className="p-3 font-mono text-xs">{orderUserDisplayId(o.userId)}</td>
                      <td className="p-3">{o.status}</td>
                      <td className="p-3">{o.currency ?? "PKR"} {o.total}</td>
                      <td className="p-3">{formatDate(o.createdAt)}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => openView(o)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loadingList}
                className="rounded-md border border-input px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loadingList}
                className="rounded-md border border-input px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      {modal === "view" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModal(null)}>
          <div
            className="rounded-xl bg-card border border-border shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Order details</h3>
            <dl className="grid grid-cols-1 gap-2 text-sm mb-4">
              <div><dt className="text-muted-foreground">Order number</dt><dd className="font-mono text-xs">{selected.orderNumber ?? selected._id}</dd></div>
              <div><dt className="text-muted-foreground">Customer ID</dt><dd className="font-mono text-xs">{orderUserDisplayId(selected.userId)}</dd></div>
              <div>
                <dt className="text-muted-foreground mb-1">Order status</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <select
                    value={statusEdit}
                    onChange={(e) => setStatusEdit(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleUpdateStatus}
                    disabled={updatingStatus || statusEdit === selected.status}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {updatingStatus ? "Updating…" : "Update status"}
                  </button>
                </dd>
                {statusError && <dd className="text-destructive text-xs mt-1">{statusError}</dd>}
              </div>
              <div><dt className="text-muted-foreground">Subtotal</dt><dd>{selected.currency ?? "PKR"} {selected.subtotal}</dd></div>
              <div><dt className="text-muted-foreground">Discount used</dt><dd>{selected.discountAmount ?? 0} {selected.discountCode ? `(${selected.discountCode})` : ""}</dd></div>
              <div><dt className="text-muted-foreground">Order total</dt><dd>{selected.currency ?? "PKR"} {selected.total}</dd></div>
              <div><dt className="text-muted-foreground">Transaction IDs</dt><dd>{(selected.transactionIds?.length ?? 0) === 0 ? "—" : selected.transactionIds!.join(", ")}</dd></div>
              <div><dt className="text-muted-foreground">Created</dt><dd>{formatDate(selected.createdAt)}</dd></div>
            </dl>
            <h4 className="text-sm font-medium mb-2">Purchased products (line items)</h4>
            <ul className="border rounded-lg divide-y divide-border">
              {(selected.lineItems ?? []).map((line, i) => (
                <li key={i} className="p-3 flex justify-between text-sm">
                  <span>{line.name} × {line.quantity}</span>
                  <span>{line.subtotal} ({selected.currency ?? "PKR"})</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
