import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, RefreshCw } from "lucide-react";
import {
  adminAPI,
  type AdminUser,
  customersAPI,
  type CustomerItem,
  type LoginActivityItem,
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

export default function Users() {
  const navigate = useNavigate();
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
  const [viewDetail, setViewDetail] = useState<CustomerItem | null>(null);
  const [userActivity, setUserActivity] = useState<LoginActivityItem[]>([]);
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

  const fetchUsers = async (p = page) => {
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
      setError(e instanceof Error ? e.message : "Failed to load users");
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (user) fetchUsers(page);
  }, [user, page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1);
  };

  const openView = async (c: CustomerItem) => {
    setSelected(c);
    setModal("view");
    setViewDetail(null);
    setUserActivity([]);
    setLoadingDetail(true);
    setError(null);
    try {
      const [custRes, activityRes] = await Promise.all([
        customersAPI.get(c._id),
        customersAPI.getLoginActivity(c._id, 50).catch(() => ({ success: true, data: [] as LoginActivityItem[] })),
      ]);
      setViewDetail(custRes.data);
      setUserActivity(activityRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load user details");
    } finally {
      setLoadingDetail(false);
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
          <h1 className="text-xl font-serif font-bold">Users</h1>
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
            onClick={() => fetchUsers(page)}
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
            <div className="p-8 text-center text-muted-foreground">Loading users...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No users found.</div>
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
                    <th className="text-left p-3 font-medium">Last login</th>
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
                      <td className="p-3">{c.accountStatus ?? "—"}</td>
                      <td className="p-3">{formatDate(c.lastLoginAt)}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => openView(c)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80"
                        >
                          <Eye className="h-3 w-3" />
                          View user info
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
            {loadingDetail ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4">User info</h3>

                <section className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">User info</h4>
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

                <section className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">User activity</h4>
                  {userActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Date</th>
                            <th className="text-left p-2">IP</th>
                            <th className="text-left p-2">Result</th>
                            <th className="text-left p-2">User agent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userActivity.map((a) => (
                            <tr key={a._id} className="border-b last:border-0">
                              <td className="p-2">{formatDate(a.createdAt)}</td>
                              <td className="p-2">{a.ip ?? "—"}</td>
                              <td className={`p-2 ${a.success ? "text-emerald-600" : "text-destructive"}`}>{a.success ? "Success" : a.failureReason ?? "Failed"}</td>
                              <td className="p-2 max-w-[200px] truncate" title={a.userAgent}>{a.userAgent ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModal(null); navigate(`/customers?view=${encodeURIComponent(selected._id)}`); }}
                    className="ml-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    View as Customer
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
