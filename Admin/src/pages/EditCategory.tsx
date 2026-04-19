import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminAPI, type AdminUser } from "@/lib/api";
import { categoriesAPI, type CategoryItem } from "@/lib/api";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { CategoryEditorForm } from "@/components/CategoryEditorForm";

function getCategoryId(c: CategoryItem): string {
  return c.id ?? (c as { _id?: string })._id ?? "";
}

export default function EditCategory() {
  const navigate = useNavigate();
  const { id: routeCategoryId } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!user || loading) return;
    if (!routeCategoryId?.trim()) {
      navigate("/categories", { replace: true });
      return;
    }
    let cancelled = false;
    setCategoryLoading(true);
    setCategoryLoadError(null);
    categoriesAPI
      .get(routeCategoryId)
      .then((res) => {
        if (cancelled) return;
        if (!res.data) {
          setCategoryLoadError("Category not found");
          return;
        }
        setCategory(res.data);
      })
      .catch((e) => {
        if (!cancelled) {
          setCategoryLoadError(e instanceof Error ? e.message : "Failed to load category");
        }
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, routeCategoryId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (categoryLoading) {
    return (
      <AdminLayout title="Edit category" userEmail={user?.email}>
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Loading category...</p>
        </div>
      </AdminLayout>
    );
  }

  if (categoryLoadError || !category) {
    return (
      <AdminLayout title="Edit category" userEmail={user?.email}>
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {categoryLoadError ?? "Category not found"}
          </div>
          <button
            type="button"
            onClick={() => navigate("/categories")}
            className="text-sm text-primary hover:underline"
          >
            ← Back to categories
          </button>
        </div>
      </AdminLayout>
    );
  }

  const cid = getCategoryId(category);

  return (
    <AdminLayout title="Edit category" userEmail={user?.email}>
      <div className="mx-auto max-w-6xl space-y-6">
        <button
          type="button"
          onClick={() => navigate("/categories")}
          className="text-sm text-primary hover:underline"
        >
          ← Back to categories
        </button>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h2 className="text-lg font-semibold">Edit category</h2>
            <p className="mt-1 text-xs text-muted-foreground font-mono break-all">ID {cid || "—"}</p>
          </div>
          <div className="p-6">
            <CategoryEditorForm
              initialValues={{
                name: category.name,
                imageUrl: category.imageUrl,
                description: category.description ?? "",
              }}
              submitLabel="Update"
              listenPaste
              onCancel={() => navigate("/categories")}
              onSubmit={async (body) => {
                setError(null);
                try {
                  await categoriesAPI.update(cid, body);
                  navigate("/categories");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to update category");
                }
              }}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
