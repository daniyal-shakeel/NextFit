import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Pencil, Boxes } from "lucide-react";
import { adminAPI, type AdminUser } from "@/lib/api";
import { inventoryAPI, type InventoryItem } from "@/lib/api";

function getCategoryName(categoryId: InventoryItem["categoryId"]): string {
  if (typeof categoryId === "object" && categoryId !== null && "name" in categoryId) {
    return (categoryId as { name: string }).name;
  }
  return typeof categoryId === "string" ? categoryId : "—";
}

export default function Inventory() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editStock, setEditStock] = useState("");
  const [editThreshold, setEditThreshold] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const fetchList = () => {
    if (!user) return;
    setLoadingList(true);
    setError(null);
    inventoryAPI
      .list()
      .then((res) => setItems(res.data.items ?? []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load inventory");
        setItems([]);
      })
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    if (user) fetchList();
  }, [user]);

  const openEdit = (item: InventoryItem) => {
    setSelected(item);
    setEditStock(String(item.stockQuantity));
    setEditThreshold(String(item.lowStockThreshold));
    setSaveError(null);
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
      await inventoryAPI.updateStock(selected.id, {
        stockQuantity: stock,
        lowStockThreshold: threshold,
      });
      setItems((prev) =>
        prev.map((p) =>
          p.id === selected.id
            ? { ...p, stockQuantity: stock, lowStockThreshold: threshold, isLowStock: threshold > 0 && stock <= threshold }
            : p
        )
      );
      closeModal();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to update stock");
    } finally {
      setSaving(false);
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
          <h1 className="text-xl font-serif font-bold flex items-center gap-2">
            <Boxes className="h-5 w-5 text-orange-600" />
            Inventory
          </h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <p className="text-sm text-muted-foreground flex-1">
            Manage stock quantity and low-stock thresholds per product.
          </p>
          <button
            type="button"
            onClick={() => fetchList()}
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
            <div className="p-8 text-center text-muted-foreground">Loading inventory…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No products found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-right p-3 font-medium">Stock</th>
                    <th className="text-right p-3 font-medium">Low stock at</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-muted-foreground text-xs">{item.slug}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">{getCategoryName(item.categoryId)}</td>
                      <td className="p-3 text-right font-mono">{item.stockQuantity}</td>
                      <td className="p-3 text-right font-mono">{item.lowStockThreshold}</td>
                      <td className="p-3 text-center">
                        {item.isLowStock ? (
                          <span className="inline-flex rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                            Low stock
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
                            In stock
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Edit stock modal */}
      {modalOpen && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-modal-title"
        >
          <div className="bg-card rounded-lg shadow-lg border border-border w-full max-w-md mx-4 p-6">
            <h2 id="inventory-modal-title" className="text-lg font-semibold mb-4">
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
            {saveError && (
              <p className="mt-2 text-sm text-destructive">{saveError}</p>
            )}
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
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
