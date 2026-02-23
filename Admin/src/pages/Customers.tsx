import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, RefreshCw, UserX, UserCheck } from "lucide-react";
import {
  adminAPI,
  type AdminUser,
  customersAPI,
  type CustomerItem,
  invoicesAPI,
  type LoginActivityItem,
  type InvoiceItem,
  ordersAPI,
} from "@/lib/api";

function formatDate(s: string | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function displayEmail(c: CustomerItem) {
  return c.email ?? c.googleEmail ?? "—";
}

export default function Customers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewIdFromUrl = searchParams.get("view");
  const openedViewIdRef = useRef<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CustomerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<CustomerItem | null>(null);
  const [modal, setModal] = useState<"view" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [viewDetail, setViewDetail] = useState<CustomerItem | null>(null);
  const [loginActivity, setLoginActivity] = useState<LoginActivityItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [ordersCount, setOrdersCount] = useState<number | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  const fetchCustomers = async (p = page) => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await customersAPI.list({
        page: p,
        limit: 10,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setItems(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
      setPage(res.data.page ?? 1);
      setTotalPages(res.data.totalPages ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customers");
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (user) fetchCustomers(page);
  }, [user, page, statusFilter]);

  useEffect(() => {
    if (!user || !viewIdFromUrl || openedViewIdRef.current === viewIdFromUrl) return;
    openedViewIdRef.current = viewIdFromUrl;
    setSelected({ _id: viewIdFromUrl } as CustomerItem);
    setModal("view");
    setViewDetail(null);
    setLoginActivity([]);
    setInvoices([]);
    setOrdersCount(null);
    setLoadingDetail(true);
    setError(null);
    Promise.all([
      customersAPI.get(viewIdFromUrl),
      customersAPI.getLoginActivity(viewIdFromUrl, 50).catch(() => ({ success: true, data: [] as LoginActivityItem[] })),
      invoicesAPI.list({ userId: viewIdFromUrl, limit: 20 }).catch(() => ({ success: true, data: { items: [] as InvoiceItem[] } })),
      ordersAPI.list({ userId: viewIdFromUrl, limit: 1 }).catch(() => ({ success: true, data: { total: 0 } })),
    ]).then(([custRes, activityRes, invRes, ordRes]) => {
      setViewDetail(custRes.data);
      setLoginActivity(activityRes.data ?? []);
      setInvoices(invRes.data?.items ?? []);
      setOrdersCount(ordRes.data?.total ?? 0);
    }).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load customer details");
    }).finally(() => {
      setLoadingDetail(false);
      setSearchParams((p) => { p.delete("view"); return p; });
    });
  }, [user, viewIdFromUrl]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers(1);
  };

  const openView = async (c: CustomerItem) => {
    setSelected(c);
    setModal("view");
    setViewDetail(null);
    setLoginActivity([]);
    setInvoices([]);
    setOrdersCount(null);
    setLoadingDetail(true);
    setError(null);
    try {
      const [custRes, activityRes, invRes, ordRes] = await Promise.all([
        customersAPI.get(c._id),
        customersAPI.getLoginActivity(c._id, 50).catch(() => ({ success: true, data: [] as LoginActivityItem[] })),
        invoicesAPI.list({ userId: c._id, limit: 20 }).catch(() => ({ success: true, data: { items: [] as InvoiceItem[] } })),
        ordersAPI.list({ userId: c._id, limit: 1 }).catch(() => ({ success: true, data: { total: 0 } })),
      ]);
      setViewDetail(custRes.data);
      setLoginActivity(activityRes.data ?? []);
      setInvoices(invRes.data?.items ?? []);
      setOrdersCount(ordRes.data?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customer details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeViewModal = () => {
    setModal(null);
    setSelected(null);
    setViewDetail(null);
    openedViewIdRef.current = null;
  };

  const updateStatus = async (id: string, status: "active" | "suspended") => {
    setActionLoading(true);
    setError(null);
    try {
      await customersAPI.updateStatus(id, status);
      closeViewModal();
      fetchCustomers(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const detail = viewDetail ?? selected;

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
          <h1 className="text-xl font-serif font-bold">Customers</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, customer ID..."
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              Search
            </button>
          </form>
          <button
            type="button"
            onClick={() => fetchCustomers(page)}
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
            <div className="p-8 text-center text-muted-foreground">Loading customers...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No customers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Customer ID</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email / Phone</th>
                    <th className="text-left p-3 font-medium">Auth</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c._id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="p-3">{c.customerId ?? "—"}</td>
                      <td className="p-3">{c.name ?? "—"}</td>
                      <td className="p-3">{displayEmail(c)} {c.phone ? ` / ${c.phone}` : ""}</td>
                      <td className="p-3">{c.authMethod ?? "—"}</td>
                      <td className="p-3">
                        <span
                          className={
                            c.accountStatus === "active"
                              ? "text-emerald-600"
                              : c.accountStatus === "suspended"
                                ? "text-amber-600"
                                : "text-muted-foreground"
                          }
                        >
                          {c.accountStatus ?? "—"}
                        </span>
                      </td>
                      <td className="p-3">{formatDate(c.createdAt)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openView(c)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                          {c.accountStatus === "suspended" && (
                            <button
                              type="button"
                              onClick={() => updateStatus(c._id, "active")}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                            >
                              <UserCheck className="h-3 w-3" />
                              Unsuspend
                            </button>
                          )}
                          {c.accountStatus === "active" && (
                            <button
                              type="button"
                              onClick={() => updateStatus(c._id, "suspended")}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100"
                            >
                              <UserX className="h-3 w-3" />
                              Suspend
                            </button>
                          )}
                        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeViewModal}>
          <div
            className="rounded-xl bg-card border border-border shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail ? (
              <p className="text-sm text-muted-foreground">Loading details...</p>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4">Customer</h3>

                {/* Basic Customer Profile */}
                <section className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Basic profile</h4>
                  <dl className="grid grid-cols-1 gap-1 text-sm">
                    <div><dt className="text-muted-foreground">Full name</dt><dd>{detail?.name ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Auth method</dt><dd>{detail?.authMethod ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Email</dt><dd>{detail ? displayEmail(detail) : "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Phone</dt><dd>{detail?.phone ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Profile photo</dt><dd>{detail?.avatar ? <a href={detail.avatar} target="_blank" rel="noreferrer" className="text-primary underline">URL</a> : "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Customer ID</dt><dd>{detail?.customerId ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Account creation date</dt><dd>{formatDate(detail?.createdAt)}</dd></div>
                    <div><dt className="text-muted-foreground">Last login date</dt><dd>{formatDate(detail?.lastLoginAt)}</dd></div>
                    <div><dt className="text-muted-foreground">Account status</dt><dd>{detail?.accountStatus ?? "—"}</dd></div>
                  </dl>
                </section>

                {/* Shipping Information */}
                <section className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Shipping addresses</h4>
                  {(detail?.shippingAddresses?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {(detail?.shippingAddresses ?? []).map((addr, i) => (
                        <li key={i} className="border rounded p-2">
                          <span className="font-medium">{addr.label ?? "—"}</span>
                          {addr.isDefault && <span className="ml-2 text-muted-foreground">(default)</span>}
                          <div>{[addr.street, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(", ") || "—"}</div>
                          {addr.deliveryInstructions && <div className="text-muted-foreground">Instructions: {addr.deliveryInstructions}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Billing Information */}
                <section className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Billing address</h4>
                  {!detail?.billingAddress ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <div className="text-sm border rounded p-2">
                      {[detail.billingAddress.street, detail.billingAddress.city, detail.billingAddress.state, detail.billingAddress.postalCode, detail.billingAddress.country].filter(Boolean).join(", ") || "—"}
                    </div>
                  )}
                </section>

                {/* Payment methods (token/reference only) */}
                <section className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Payment methods (token reference only)</h4>
                  {(detail?.paymentMethods?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {(detail?.paymentMethods ?? []).map((pm, i) => (
                        <li key={i}>
                          {pm.brand ?? "Card"} {pm.last4 ? `••••${pm.last4}` : ""} {pm.expiryMonth && pm.expiryYear ? `(${pm.expiryMonth}/${pm.expiryYear})` : ""} {pm.isDefault ? "(default)" : ""} — token ref stored
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Order history */}
                <section className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Order history</h4>
                  <p className="text-sm">
                    {ordersCount !== null ? `${ordersCount} order(s). ` : ""}
                    <button
                      type="button"
                      onClick={() => { closeViewModal(); navigate(`/orders?userId=${encodeURIComponent(selected.customerId ?? selected._id)}`); }}
                      className="text-primary underline"
                    >
                      View in Orders
                    </button>
                  </p>
                </section>

                {/* User activity (login activity, IP, failed attempts) */}
                <section className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">User activity</h4>
                  {loginActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <ul className="space-y-1 text-sm max-h-40 overflow-y-auto">
                      {loginActivity.map((a) => (
                        <li key={a._id} className="flex justify-between gap-2">
                          <span>{formatDate(a.createdAt)}</span>
                          <span>{a.ip ?? "—"}</span>
                          <span className={a.success ? "text-emerald-600" : "text-destructive"}>{a.success ? "OK" : a.failureReason ?? "Failed"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Invoice history */}
                <section className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Invoice history</h4>
                  {invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {invoices.map((inv) => (
                        <li key={inv._id}>
                          {inv.invoiceNumber} — {inv.currency} {inv.amount} — {inv.status} {inv.transactionId ? ` (tx: ${inv.transactionId})` : ""} — {formatDate(inv.createdAt)}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <div className="mt-6 flex gap-2">
                  {detail?.accountStatus === "suspended" && (
                    <button
                      type="button"
                      onClick={() => detail && updateStatus(detail._id, "active")}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
                    >
                      <UserCheck className="h-4 w-4" />
                      Unsuspend
                    </button>
                  )}
                  {detail?.accountStatus === "active" && (
                    <button
                      type="button"
                      onClick={() => detail && updateStatus(detail._id, "suspended")}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700"
                    >
                      <UserX className="h-4 w-4" />
                      Suspend
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeViewModal}
                    className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
