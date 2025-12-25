"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import StockBadge from "../../../components/StockBadge";
import { useAuth } from "../../../context/AuthContext";
import { clearStoredTokens } from "../../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ---- Lighter panels + NO black block behind catalog cards ---- */
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

const btnDanger =
  "border border-red-500/25 bg-red-500/10 text-red-100 hover:bg-red-500/15";

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

function handleAuthRedirectFromError(err, nextPath) {
  const s = err?.status;
  if (s === 401) {
    clearStoredTokens();
    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
    return true;
  }
  if (s === 403) {
    window.location.href = "/";
    return true;
  }
  return false;
}

export default function AdminProductsPage() {
  const { user, loadingUser } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Create product form
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageFile, setNewImageFile] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newSerialNumber, setNewSerialNumber] = useState("");
  const [newWarrantyStatus, setNewWarrantyStatus] = useState("");
  const [newDistributorInfo, setNewDistributorInfo] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit product
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editWarrantyStatus, setEditWarrantyStatus] = useState("");
  const [editDistributorInfo, setEditDistributorInfo] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Per-product image upload state
  const [imageUploadingId, setImageUploadingId] = useState(null);

  // Delete product
  const [deletingId, setDeletingId] = useState(null);

  // Reviews (API STATE)
  const [pendingReviews, setPendingReviews] = useState([]);

  const isAdmin = user?.roleName === "admin";
  const canEditCatalog = canCatalogRole(user);

  async function safeJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  function getCategoryLabel(categoryId) {
    if (categoryId == null) return "No category";
    return `Category ${categoryId}`;
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setMessage("");

      if (!user || !canEditCatalog) {
        setLoading(false);
        return;
      }

      const token =
        typeof window !== "undefined" ? window.localStorage.getItem("token") : null;

      try {
        const prodRes = await fetch(`${apiBase}/products`);
        if (prodRes.ok) {
          const j = await safeJson(prodRes);
          if (Array.isArray(j)) setProducts(j);
        } else {
          setProducts([]);
        }

        // Pending reviews still admin-only
        if (token && isAdmin) {
          const revRes = await fetch(`${apiBase}/reviews/pending`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (handleAuthRedirectFromResponse(revRes, "/admin/products")) return;

          if (revRes.ok) {
            const reviewsData = await revRes.json();
            setPendingReviews(Array.isArray(reviewsData) ? reviewsData : []);
          } else {
            setPendingReviews([]);
          }
        } else {
          setPendingReviews([]);
        }
      } catch (err) {
        console.error("Admin products load error:", err);
        if (handleAuthRedirectFromError(err, "/admin/products")) return;
        setMessage("Failed to load catalog.");
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser) loadData();
  }, [loadingUser, user, canEditCatalog, isAdmin]);

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name || "");
    setEditPrice(String(p.price ?? ""));
    setEditStock(String(p.stock ?? ""));
    setEditDescription(p.description || "");
    setEditModel(p.model || "");
    setEditSerialNumber(p.serialNumber || "");
    setEditWarrantyStatus(p.warrantyStatus || "");
    setEditDistributorInfo(p.distributorInfo || "");
    setEditCategory(p.categoryId == null ? "" : String(p.categoryId));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
    setEditStock("");
    setEditDescription("");
    setEditModel("");
    setEditSerialNumber("");
    setEditWarrantyStatus("");
    setEditDistributorInfo("");
    setEditCategory("");
  }

  async function uploadProductImage(productId, file) {
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;

    if (!token) {
      setMessage("Please login.");
      return;
    }

    setImageUploadingId(productId);
    setMessage("");

    try {
      const fd = new FormData();
      fd.append("image", file);

      const res = await fetch(`${apiBase}/products/${productId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (handleAuthRedirectFromResponse(res, "/admin/products")) return;

      if (!res.ok) {
        const data = await safeJson(res);
        setMessage(data?.message || "Image upload failed");
        return;
      }

      const updated = await res.json();
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      setMessage("Image updated.");
    } catch (err) {
      console.error("Upload image error:", err);
      if (handleAuthRedirectFromError(err, "/admin/products")) return;
      setMessage("Image upload failed");
    } finally {
      setImageUploadingId(null);
    }
  }

  async function handleCreate() {
    if (!canEditCatalog) {
      setMessage("You do not have permissions to add products.");
      return;
    }

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) {
      setMessage("Please login.");
      return;
    }

    const priceNumber = Number(newPrice);
    const stockNumber = Number(newStock);

    if (!newName.trim()) return setMessage("Name is required.");
    if (Number.isNaN(priceNumber) || priceNumber < 0)
      return setMessage("Price must be a valid number.");
    if (!Number.isInteger(stockNumber) || stockNumber < 0)
      return setMessage("Stock must be a non-negative integer.");
    if (!newDescription.trim()) return setMessage("Description is required.");

    setCreating(true);
    setMessage("");

    try {
      const categoryId = newCategory ? Number(newCategory) : null;

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
          model: newModel || "",
          serialNumber: newSerialNumber || "",
          warrantyStatus: newWarrantyStatus || "",
          distributorInfo: newDistributorInfo || "",
          categoryId,
        }),
      });

      if (handleAuthRedirectFromResponse(res, "/admin/products")) return;

      if (!res.ok) {
        const data = await safeJson(res);
        setMessage(data?.message || "Create failed");
        return;
      }

      const created = await res.json();
      setProducts((prev) => [created, ...prev]);

      if (newImageFile) {
        await uploadProductImage(created.id, newImageFile);
      }

      setNewName("");
      setNewPrice("");
      setNewStock("");
      setNewDescription("");
      setNewImageFile(null);
      setNewCategory("");
      setNewModel("");
      setNewSerialNumber("");
      setNewWarrantyStatus("");
      setNewDistributorInfo("");

      setMessage("Product created.");
    } catch (err) {
      console.error("Create product error:", err);
      if (handleAuthRedirectFromError(err, "/admin/products")) return;
      setMessage("Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(productId) {
    if (!canEditCatalog)
      return setMessage("You do not have permissions to update products.");

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) return setMessage("Please login.");

    const stockNumber = Number(editStock);
    if (!Number.isInteger(stockNumber) || stockNumber < 0)
      return setMessage("Stock must be a non-negative integer.");

    const priceNumber = Number(editPrice);
    if (Number.isNaN(priceNumber) || priceNumber < 0)
      return setMessage("Price must be a valid number.");

    setSavingEdit(true);
    const categoryId = editCategory ? Number(editCategory) : null;

    try {
      const res = await fetch(`${apiBase}/products/${productId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          price: priceNumber,
          stock: stockNumber,
          isActive: true,
          model: editModel || "",
          serialNumber: editSerialNumber || "",
          warrantyStatus: editWarrantyStatus || "",
          distributorInfo: editDistributorInfo || "",
          categoryId,
        }),
      });

      if (handleAuthRedirectFromResponse(res, "/admin/products")) return;

      if (res.ok) {
        const data = await res.json();
        setProducts((prev) => prev.map((p) => (p.id === productId ? data : p)));
        cancelEdit();
        setMessage("Product updated.");
      } else {
        const data = await safeJson(res);
        setMessage(data?.message || "Update failed");
      }
    } catch (err) {
      console.error("Update failed:", err);
      if (handleAuthRedirectFromError(err, "/admin/products")) return;
      setMessage("Update failed");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(productId) {
    if (!canEditCatalog)
      return setMessage("You do not have permissions to delete products.");
    if (!confirm("Delete this product?")) return;

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) return setMessage("Please login.");

    setDeletingId(productId);
    try {
      const res = await fetch(`${apiBase}/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (handleAuthRedirectFromResponse(res, "/admin/products")) return;

      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        setMessage("Product deleted.");
      } else {
        const data = await safeJson(res);
        setMessage(data?.message || "Delete failed");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      if (handleAuthRedirectFromError(err, "/admin/products")) return;
      setMessage("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const [query, setQuery] = useState("");
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = `${p.name || ""} ${p.description || ""} ${p.model || ""} ${
        p.serialNumber || ""
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, query]);

  /* ----------------- states ----------------- */
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
    const isSales = user?.roleName === "sales_manager";
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
              You need admin or product manager permissions to manage the catalog.
            </p>

            {isSales && (
              <DripLink
                href="/sales-admin"
                className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
              >
                Go to Sales Manager panel →
              </DripLink>
            )}

            <DripLink
              href="/"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to homepage
            </DripLink>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------- page ----------------- */
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
              Product catalog
            </h1>
            <p className="text-sm text-gray-300/70">
              Admins and product managers can edit the catalog.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <span className={chip("muted")}>{products.length} products</span>
              <span className={chip(pendingReviews.length ? "warn" : "muted")}>
                {pendingReviews.length} pending reviews
              </span>
            </div>
          </div>

          <DripLink
            href="/admin"
            className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
          >
            Back to dashboard
          </DripLink>
        </div>

        {message && (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
            {message}
          </div>
        )}

        {/* Add Product */}
        <div className={panelClass()}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                Add product
              </p>
              <p className="mt-1 text-[12px] text-gray-300/70">
                Fill the essentials, then optional metadata. Upload an image to finish.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={chip("ok")}>Catalog tools</span>
              <span className={chip("muted")}>Fast create</span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.92fr]">
            {/* Left */}
            <div className="space-y-4 flex flex-col">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Product name *"
                  className={fieldBase}
                />
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Category ID (optional)"
                  className={fieldBase}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="Price *"
                  inputMode="decimal"
                  className={fieldBase}
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
                className={textAreaBase + " flex-1 min-h-[220px]"}
              />
            </div>

            {/* Right */}
            <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-4">
              <p className="text-[10px] font-semibold tracking-[0.26em] uppercase text-gray-300/60">
                Optional details
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Model" className={fieldBase} />
                <input value={newSerialNumber} onChange={(e) => setNewSerialNumber(e.target.value)} placeholder="Serial number" className={fieldBase} />
                <input value={newWarrantyStatus} onChange={(e) => setNewWarrantyStatus(e.target.value)} placeholder="Warranty status" className={fieldBase} />
                <input value={newDistributorInfo} onChange={(e) => setNewDistributorInfo(e.target.value)} placeholder="Distributor info" className={fieldBase} />
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-white/90">Product image</p>
                    <p className="text-[11px] text-gray-300/60">
                      {newImageFile ? (
                        <span className="text-gray-200/80 break-all">{newImageFile.name}</span>
                      ) : (
                        "PNG/JPG/WebP recommended"
                      )}
                    </p>
                  </div>

                  <label className={btnBase + " " + btnGhost + " cursor-pointer px-5"}>
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

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-white/10 pt-5">
            <div className="text-[11px] text-gray-300/60">
              Fields marked with <span className="text-white/80">*</span> are required.
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <button
                type="button"
                onClick={() => {
                  setNewName("");
                  setNewPrice("");
                  setNewStock("");
                  setNewDescription("");
                  setNewImageFile(null);
                  setNewCategory("");
                  setNewModel("");
                  setNewSerialNumber("");
                  setNewWarrantyStatus("");
                  setNewDistributorInfo("");
                  setMessage("");
                }}
                className={btnBase + " " + btnGhost}
                disabled={creating}
              >
                Clear
              </button>

              <button
                type="button"
                disabled={creating}
                onClick={handleCreate}
                className={btnBase + " " + btnPrimary}
              >
                {creating ? "Creating…" : "Create product"}
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className={panelClass()}>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
              Catalog
            </p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="h-11 w-full md:w-[420px] rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-gray-400/60 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]"
            />
          </div>
        </div>

        {/* LIST WRAPPER UPDATED: removed any dark backing container */}
        {loading ? (
          <div className={panelClass()}>
            <p className="text-sm text-gray-300/70">Loading catalog…</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={panelClass()}>
            <p className="text-sm text-gray-300/70">No products found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((p) => {
              const isEditing = editingId === p.id;
              const imageUrl = p.imageUrl ? `${apiBase}${p.imageUrl}` : null;

              return (
                <div key={p.id} className={panelClass()}>
                  <div className="flex flex-col lg:flex-row gap-5">
                    <div className="w-full lg:w-[220px] space-y-2">
                      <div className="w-full aspect-square rounded-[28px] overflow-hidden border border-white/10 bg-white/5">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={p.name || "Product image"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] uppercase tracking-[0.28em] text-gray-300/50">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={chip("muted")}>
                          {p.isActive === false ? "Inactive" : "Active"}
                        </span>
                        <span className={chip("muted")}>{getCategoryLabel(p.categoryId)}</span>
                        {p.discountRate ? (
                          <span className={chip("warn")}>
                            {Number(p.discountRate).toFixed(2)}% off
                          </span>
                        ) : null}
                      </div>

                      <label className={btnBase + " " + btnGhost + " w-full cursor-pointer px-4"}>
                        {imageUploadingId === p.id
                          ? "Uploading…"
                          : imageUrl
                          ? "Replace image"
                          : "Upload image"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={imageUploadingId === p.id}
                          onChange={async (e) => {
                            const file = e.target.files?.[0] || null;
                            if (!file) return;
                            await uploadProductImage(p.id, file);
                          }}
                        />
                      </label>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          {isEditing ? (
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className={fieldBase + " w-full"}
                            />
                          ) : (
                            <h2 className="text-lg font-semibold text-white truncate">{p.name}</h2>
                          )}

                          <p className="text-[11px] text-gray-300/60">
                            ID: {p.id} · Model: {p.model || "—"} · Serial: {p.serialNumber || "—"}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-300/60 uppercase tracking-[0.18em]">$</span>
                              <input
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className={fieldBase + " w-28 text-right"}
                              />
                            </div>
                          ) : (
                            <p className="text-lg font-semibold text-white">
                              ${Number(p.price || 0).toFixed(2)}
                            </p>
                          )}

                          {!isEditing ? (
                            <StockBadge
                              stock={p.stock}
                              ink="light"
                              className="border-white/10 bg-white/5 text-gray-100/80"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-300/60 uppercase tracking-[0.18em]">
                                Stock
                              </span>
                              <input
                                value={editStock}
                                onChange={(e) => setEditStock(e.target.value)}
                                className={fieldBase + " w-24 text-right"}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                          Description
                        </p>
                        {isEditing ? (
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={3}
                            className={textAreaBase + " w-full"}
                          />
                        ) : (
                          <p className="text-sm text-gray-200/80 leading-relaxed">
                            {p.description || (
                              <span className="text-gray-300/50 italic">
                                No description set.
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/10">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => handleSaveEdit(p.id)}
                              className={btnBase + " " + btnPrimary}
                            >
                              {savingEdit ? "Saving…" : "Save"}
                            </button>

                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={cancelEdit}
                              className={btnBase + " " + btnGhost}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(p)}
                              className={btnBase + " " + btnGhost}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={deletingId === p.id}
                              onClick={() => handleDelete(p.id)}
                              className={btnBase + " " + btnDanger}
                            >
                              {deletingId === p.id ? "Deleting…" : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
