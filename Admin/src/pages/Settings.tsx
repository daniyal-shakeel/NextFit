import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2, Save } from "lucide-react";
import { adminAPI, type AdminUser, settingsAPI, type AdminIntegrationStatus } from "@/lib/api";
import { AdminLayout } from "@/components/layout/AdminLayout";

function StatusRow({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>
      {ok ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Configured" />
      ) : (
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Not configured" />
      )}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<AdminIntegrationStatus | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [lowStock, setLowStock] = useState(5);
  const [shippingRate, setShippingRate] = useState(10);
  const [freeShippingMin, setFreeShippingMin] = useState(100);
  const [aiDesc, setAiDesc] = useState(true);
  const [aiTags, setAiTags] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

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

  const loadSettings = () => {
    if (!user) return;
    setError(null);
    settingsAPI
      .get()
      .then((res) => {
        const p = res.data.preferences;
        setIntegrations(res.data.integrations);
        setStockQty(p.defaultStockQuantity);
        setLowStock(p.defaultLowStockThreshold);
        setShippingRate(p.shippingRate ?? 10);
        setFreeShippingMin(p.freeShippingMinSubtotal ?? 100);
        setAiDesc(p.aiDescriptionSuggestionsEnabled);
        setAiTags(p.aiTagSuggestionsEnabled);
        setUpdatedAt(p.updatedAt);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load settings");
      });
  };

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await settingsAPI.update({
        defaultStockQuantity: stockQty,
        defaultLowStockThreshold: lowStock,
        shippingRate,
        freeShippingMinSubtotal: freeShippingMin,
        aiDescriptionSuggestionsEnabled: aiDesc,
        aiTagSuggestionsEnabled: aiTags,
      });
      setIntegrations(res.data.integrations);
      setUpdatedAt(res.data.preferences.updatedAt);
      setSuccess(res.message || "Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
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
    <AdminLayout title="Settings" userEmail={user?.email}>
      <div className="mx-auto max-w-4xl space-y-8">
        <p className="text-sm text-muted-foreground">
          Preferences are stored in the database and apply to new products and AI endpoints. Integration status reflects{" "}
          <code className="text-xs rounded bg-muted px-1 py-0.5">.env</code> on the server (read-only).
        </p>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
            {success}
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Server integrations</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Matches features used in NextFit: auth, catalog, customers (Firebase), AI suggestions (Groq), virtual try-on (Modal), email, Cloudinary uploads.
            </p>
          </div>
          <div className="p-4">
            {integrations ? (
              <div className="divide-y divide-border rounded-lg border border-border px-3 bg-muted/20">
                <StatusRow label="JWT secret" ok={integrations.jwtSecretConfigured} hint="Required for tokens" />
                <StatusRow label="Admin login (.env)" ok={integrations.adminEnvLoginConfigured} hint="ADMIN_EMAIL / ADMIN_PASSWORD" />
                <StatusRow label="MongoDB URI" ok={integrations.mongodbUriSet} hint="Database connection string set" />
                <StatusRow label="Cloudinary" ok={integrations.cloudinaryConfigured} hint="Server-side uploads (avatars, etc.)" />
                <StatusRow label="Firebase Admin" ok={integrations.firebaseConfigured} hint="Phone / Google sign-in verification" />
                <StatusRow label="AI service (Groq)" ok={integrations.aiServiceConfigured} hint="NEXTFIT_ADMIN_CONSOLE_API_KEY_GROQ — suggestions & product assistant" />
                <StatusRow label="Virtual try-on (Modal)" ok={integrations.virtualTryOnConfigured} hint="MODAL_AI_URL" />
                <StatusRow label="SMTP host" ok={integrations.emailSmtpHostConfigured} hint="Transactional email" />
                <div className="py-2 text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">CORS frontend:</span> {integrations.frontendUrl}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">CORS admin:</span> {integrations.adminUrl}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">NODE_ENV:</span> {integrations.nodeEnv}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading status…
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Operational preferences</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Shipping amounts apply to cart checkout and order totals. Orders at or above the minimum subtotal get free
              shipping; otherwise the flat shipping rate applies. New products inherit default stock and low-stock
              threshold. AI toggles gate{" "}
              <code className="text-xs rounded bg-muted px-1">/api/ai/suggest-description</code>,{" "}
              <code className="text-xs rounded bg-muted px-1">/api/ai/suggest-features</code> (same toggle as description), and{" "}
              <code className="text-xs rounded bg-muted px-1">/api/ai/suggest-tags</code>.
            </p>
            {updatedAt ? (
              <p className="text-xs text-muted-foreground mt-2">Last updated: {new Date(updatedAt).toLocaleString()}</p>
            ) : null}
          </div>
          <form onSubmit={handleSave} className="p-4 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="default-stock" className="block text-sm font-medium mb-1">
                  Default stock for new products
                </label>
                <input
                  id="default-stock"
                  type="number"
                  min={0}
                  max={1000000}
                  value={stockQty}
                  onChange={(e) => setStockQty(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="low-stock" className="block text-sm font-medium mb-1">
                  Default low-stock threshold
                </label>
                <input
                  id="low-stock"
                  type="number"
                  min={0}
                  max={1000000}
                  value={lowStock}
                  onChange={(e) => setLowStock(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="shipping-rate" className="block text-sm font-medium mb-1">
                  Flat shipping rate (PKR)
                </label>
                <input
                  id="shipping-rate"
                  type="number"
                  min={0}
                  max={1000000}
                  step="0.01"
                  value={shippingRate}
                  onChange={(e) => setShippingRate(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="free-shipping-min" className="block text-sm font-medium mb-1">
                  Free shipping minimum subtotal (PKR)
                </label>
                <input
                  id="free-shipping-min"
                  type="number"
                  min={0}
                  max={1000000000}
                  step="0.01"
                  value={freeShippingMin}
                  onChange={(e) => setFreeShippingMin(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Cart subtotal at or above this amount is charged no shipping.</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiDesc}
                  onChange={(e) => setAiDesc(e.target.checked)}
                  className="rounded border-input h-4 w-4"
                />
                <span className="text-sm">Allow AI description and feature suggestions (admin Category/Product)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiTags}
                  onChange={(e) => setAiTags(e.target.checked)}
                  className="rounded border-input h-4 w-4"
                />
                <span className="text-sm">Allow AI tag suggestions (admin Product modal)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save preferences
            </button>
          </form>
        </section>

        <p className="text-xs text-muted-foreground">
          If Save fails with “Insufficient permissions”, sign out and sign in again so your admin token includes the new{" "}
          <code className="rounded bg-muted px-1">settings</code> permissions.
        </p>
      </div>
    </AdminLayout>
  );
}
