"use client";

import { useEffect, useState } from "react";
import DripLink from "../../../../components/DripLink";
import { useAuth } from "../../../../context/AuthContext";
import { apiRequest, clearStoredTokens } from "../../../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ---------- UI helpers copied from admin/products/page.jsx ---------- */
function panelClass() {
  return [
    "rounded-[34px]",
    "border border-white/10",
    "bg-white/[0.04]",
    "backdrop-blur-xl",
    "p-5 sm:p-6",
    "shadow-[0_18px_70px_rgba(0,0,0,0.45)]",
  ].join(" ");
}

function chipBase() {
  return "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border whitespace-nowrap";
}
function chip(tone = "muted") {
  const base = chipBase();
  if (tone === "warn") return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (tone === "ok") return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (tone === "bad") return `${base} border-red-500/25 bg-red-500/10 text-red-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

const fieldBase =
  "h-11 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-gray-400/60 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]";

const textAreaBase =
  "rounded-[26px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-gray-400/60 resize-none focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]";

const btnBase =
  "h-11 inline-flex items-center justify-center rounded-full px-6 text-[11px] font-semibold uppercase tracking-[0.18em] transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

const btnPrimary =
  "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black hover:opacity-95";

const btnGhost = "border border-white/10 bg-white/5 text-white/90 hover:bg-white/10";

function canCatalogRole(user) {
  const rn = user?.roleName || user?.role || user?.role_name || "";
  return rn === "admin" || rn === "product_manager";
}

function handleAuthRedirectFromResponse(res, nextPath) {
  if (!res) return false;

  if (res.status === 401) {
    clearStoredTokens();
    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
    return true;
  }
  if (res.status === 403) {
    window.location.href = "/";
    return true;
  }
  return false;
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */

export default function AdminAddProductPage() {
  const { user, loadingUser } = useAuth();
  const canEditCatalog = canCatalogRole(user);

  const [categories, setCategories] = useState([]);

  // Form state (same as your products page)
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("0"); // fixed
  const [newStock, setNewStock] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageFile, setNewImageFile] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newSerialNumber, setNewSerialNumber] = useState("");
  const [newWarrantyStatus, setNewWarrantyStatus] = useState("");
  const [newDistributorInfo, setNewDistributorInfo] = useState("");

  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function setMsg(msg, error = false) {
    setMessage(msg);
    setIsError(error);
    if (!error && msg) setTimeout(() => setMessage(""), 3000);
  }

  // dropdown class helper (same fix)
  const selectFixClass =
    fieldBase + " bg-black/40 text-white [&>option]:bg-black [&>option]:text-white";

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await apiRequest("/categories", { method: "GET" });
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load categories", e);
        setCategories([]);
      }
    }

    if (!loadingUser && user && canEditCatalog) loadCategories();
  }, [loadingUser, user, canEditCatalog]);

  async function uploadProductImage(productId, file) {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;

    if (!token) {
      setMsg("Please login.", true);
      return;
    }

    try {
      const fd = new FormData();
      fd.append("image", file);

      const res = await fetch(`${apiBase}/products/${productId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (handleAuthRedirectFromResponse(res, "/admin/products/add")) return;

      if (!res.ok) {
        const data = await safeJson(res);
        setMsg(data?.message || "Image upload failed", true);
        return;
      }

      setMsg("Image uploaded.");
    } catch (err) {
      console.error("Upload image error:", err);
      setMsg("Image upload failed", true);
    }
  }

  async function handleCreate() {
    if (!canEditCatalog) return setMsg("You do not have permissions to add products.", true);

    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) return setMsg("Please login.", true);

    const priceNumber = 0; // fixed
    const stockNumber = Number(newStock);

    if (!newName.trim()) return setMsg("Product name is required.", true);
    if (!Number.isInteger(stockNumber) || stockNumber < 0)
      return setMsg("Stock must be a non-negative integer.", true);
    if (!newDescription.trim()) return setMsg("Description is required.", true);

    if (!newCategory) return setMsg("Category is required.", true);
    if (!newModel.trim()) return setMsg("Model is required.", true);
    if (!newSerialNumber.trim()) return setMsg("Serial number is required.", true);
    if (!newWarrantyStatus.trim()) return setMsg("Warranty status is required.", true);
    if (!newDistributorInfo.trim()) return setMsg("Distributor info is required.", true);
    if (!newImageFile) return setMsg("Product image is required.", true);

    setCreating(true);
    setMessage("");

    try {
      const categoryId = Number(newCategory);

      const res = await fetch(`${apiBase}/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          price: priceNumber,
          stock: stockNumber,
          isActive: true,
          model: newModel,
          serialNumber: newSerialNumber,
          warrantyStatus: newWarrantyStatus,
          distributorInfo: newDistributorInfo,
          categoryId,
        }),
      });

      if (handleAuthRedirectFromResponse(res, "/admin/products/add")) return;

      if (!res.ok) {
        const data = await safeJson(res);
        setMsg(data?.message || "Create failed", true);
        return;
      }

      const created = await res.json();

      await uploadProductImage(created.id, newImageFile);

      // Reset
      setNewName("");
      setNewPrice("0");
      setNewStock("");
      setNewDescription("");
      setNewImageFile(null);
      setNewCategory("");
      setNewModel("");
      setNewSerialNumber("");
      setNewWarrantyStatus("");
      setNewDistributorInfo("");

      setMsg("Product created.");
    } catch (err) {
      console.error("Create product error:", err);
      setMsg("Create failed", true);
    } finally {
      setCreating(false);
    }
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-sm text-gray-300/70">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!user || !canEditCatalog) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Access denied
            </h1>
            <p className="text-sm text-gray-300/70">
              You need admin or product manager permissions to add products.
            </p>
            <DripLink
              href="/admin"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to dashboard
            </DripLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Sneaks-up · Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Add product
            </h1>
            <p className="text-sm text-gray-300/70">All fields are mandatory.</p>
            <div className="pt-2 flex flex-wrap gap-2">
              <span className={chip("ok")}>Active</span>
              <span className={chip("muted")}>Price fixed: 0</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <DripLink
              href="/admin/products"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to products
            </DripLink>
            <DripLink
              href="/admin"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to dashboard
            </DripLink>
          </div>
        </div>

        {/* Form */}
        <div className={panelClass() + " border-white/20"}>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Product name *"
                  className={fieldBase}
                />

                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className={selectFixClass}
                >
                  <option value="">Select Category *</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={newPrice}
                  onChange={() => {}}
                  placeholder="Price *"
                  className={fieldBase + " opacity-60 cursor-not-allowed"}
                  disabled
                  title="Price is fixed to 0 for this form"
                />

                <input
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  placeholder="Stock *"
                  inputMode="numeric"
                  className={fieldBase}
                />
              </div>

              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description *"
                rows={7}
                className={textAreaBase + " w-full min-h-[220px]"}
              />
            </div>

            <div className="space-y-4 rounded-[28px] bg-white/5 p-5 border border-white/5">
              <p className="text-[10px] font-semibold tracking-[0.26em] uppercase text-white/50 mb-2">
                Required Details
              </p>

              <div className="grid gap-3">
                <input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Model *" className={fieldBase} />
                <input value={newSerialNumber} onChange={(e) => setNewSerialNumber(e.target.value)} placeholder="Serial number *" className={fieldBase} />
                <input value={newWarrantyStatus} onChange={(e) => setNewWarrantyStatus(e.target.value)} placeholder="Warranty status *" className={fieldBase} />
                <input value={newDistributorInfo} onChange={(e) => setNewDistributorInfo(e.target.value)} placeholder="Distributor info *" className={fieldBase} />
              </div>

              <div className="mt-2 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-white/90">Product image *</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                      {newImageFile ? (
                        <span className="text-emerald-300">{newImageFile.name}</span>
                      ) : (
                        "No file chosen"
                      )}
                    </p>
                  </div>

                  <label className={`${btnBase} ${btnGhost} h-9 px-4 text-[10px] cursor-pointer`}>
                    Choose file
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-white/10 pt-6">
            <div className="flex-1">
              {message && (
                <span className={`text-xs font-medium ${isError ? "text-red-400" : "text-emerald-400"}`}>
                  {isError ? "⚠️ " : "✓ "} {message}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <DripLink href="/admin/products" className={btnBase + " " + btnGhost}>
                Cancel
              </DripLink>

              <button
                type="button"
                disabled={creating}
                onClick={handleCreate}
                className={btnBase + " " + btnPrimary}
              >
                {creating ? "Creating…" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
