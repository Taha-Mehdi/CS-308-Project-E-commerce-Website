"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";
import { clearStoredTokens } from "../../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function panelClass(extra = "") {
  return [
    "rounded-[34px]",
    "border border-white/10",
    "bg-white/[0.04]",
    "backdrop-blur-xl",
    "p-5 sm:p-6",
    "shadow-[0_18px_70px_rgba(0,0,0,0.45)]",
    extra,
  ].join(" ");
}

function chipBase() {
  return "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border whitespace-nowrap";
}
function chip(tone = "muted") {
  const base = chipBase();
  if (tone === "warn") return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (tone === "ok") return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (tone === "bad") return `${base} border-red-500/25 bg-red-500/10 text-red-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function stockChip(stock) {
  const s = Number(stock ?? 0);
  if (s <= 0) return { tone: "bad", label: "Out of stock" };
  if (s <= 5) return { tone: "warn", label: `Low stock · ${s}` };
  return { tone: "ok", label: `Stock · ${s}` };
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
  const [categories, setCategories] = useState([]); // labels + edit dropdown

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

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

  const [imageUploadingId, setImageUploadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const isProductManager = user?.roleName === "product_manager";
  const canEditCatalog = canCatalogRole(user);

  function setMsg(msg, error = false) {
    setMessage(msg);
    setIsError(error);
    if (!error && msg) setTimeout(() => setMessage(""), 3000);
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

  function getCategoryLabel(categoryId) {
    if (categoryId == null) return "No category";
    const found = categories.find((c) => c.id === categoryId);
    return found ? found.name : `Category ${categoryId}`;
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setMessage("");

      if (!user || !canEditCatalog) {
        setLoading(false);
        return;
      }

      try {
        const prodRes = await fetch(`${apiBase}/products`);
        if (prodRes.ok) {
          const j = await safeJson(prodRes);
          if (Array.isArray(j)) setProducts(j);
        } else {
          setProducts([]);
        }

        try {
          const catRes = await fetch(`${apiBase}/categories`);
          if (catRes.ok) setCategories(await catRes.json());
          else setCategories([]);
        } catch (e) {
          console.error("Failed to load categories", e);
          setCategories([]);
        }
      } catch (err) {
        console.error("Admin products load error:", err);
        if (handleAuthRedirectFromError(err, "/admin/products")) return;
        setMsg("Failed to load catalog.", true);
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser) loadData();
  }, [loadingUser, user, canEditCatalog]);

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
      setMsg("Please login.", true);
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
        setMsg(data?.message || "Image upload failed", true);
        return;
      }

      const data = await res.json();
      const updatedProduct = data.product || data;

      setProducts((prev) => prev.map((p) => (p.id === productId ? updatedProduct : p)));
      setMsg("Image updated.");
    } catch (err) {
      console.error("Upload image error:", err);
      if (handleAuthRedirectFromError(err, "/admin/products")) return;
      setMsg("Image upload failed", true);
    } finally {
      setImageUploadingId(null);
    }
  }

  async function handleSaveEdit(productId) {
    if (!canEditCatalog)
      return setMsg("You do not have permissions to update products.", true);

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) return setMsg("Please login.", true);

    const stockNumber = Number(editStock);
    if (!Number.isInteger(stockNumber) || stockNumber < 0)
      return setMsg("Stock must be a non-negative integer.", true);

    const priceNumber = Number(editPrice);
    if (Number.isNaN(priceNumber) || priceNumber < 0)
      return setMsg("Price must be a valid number.", true);

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
        setMsg("Product updated.");
      } else {
        const data = await safeJson(res);
        setMsg(data?.message || "Update failed", true);
      }
    } catch (err) {
      console.error("Update failed:", err);
      if (handleAuthRedirectFromError(err, "/admin/products")) return;
      setMsg("Update failed", true);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(productId) {
    if (!canEditCatalog)
      return setMsg("You do not have permissions to delete products.", true);
    if (!confirm("Delete this product?")) return;

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) return setMsg("Please login.", true);

    setDeletingId(productId);
    try {
      const res = await fetch(`${apiBase}/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (handleAuthRedirectFromResponse(res, "/admin/products")) return;

      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        setMsg("Product deleted.");
      } else {
        const data = await safeJson(res);
        setMsg(data?.message || "Delete failed", true);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      if (handleAuthRedirectFromError(err, "/admin/products")) return;
      setMsg("Delete failed", true);
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
              You need admin or product manager permissions to manage the catalog.
            </p>
            {user?.roleName === "sales_manager" && (
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

  // ✅ Better dropdown UI (open list looks nicer + readable)
  const selectFixClass =
    fieldBase +
    " bg-black/70 text-white [&>option]:bg-[#0b0b0c] [&>option]:text-white [&>option]:py-2 " +
    "shadow-[0_18px_60px_rgba(0,0,0,0.65)]";

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Sneaks-up · Admin
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Product catalog
            </h1>
            <p className="text-sm text-gray-300/70">
              Manage inventory, images, and product details.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <span className={chip("muted")}>{products.length} products</span>
              <span className={chip("muted")}>Search, edit, delete, upload images</span>
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
          <div
            className={`rounded-2xl border px-4 py-3 text-[11px] font-medium ${
              isError
                ? "border-red-500/20 bg-red-500/10 text-red-200"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {message}
          </div>
        )}

        {/* Search */}
        <div className={panelClass("py-4 sm:py-5")}>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full border border-white/10 bg-white/5 grid place-items-center">
                <span className="text-[10px] font-semibold tracking-[0.18em] text-white/70">
                  🔎
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                  Catalog
                </p>
                <p className="text-[12px] text-gray-300/50">
                  Filter by name, model, serial, or description.
                </p>
              </div>
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="h-11 w-full md:w-[420px] rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-gray-400/60 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]"
            />
          </div>
        </div>

        {loading ? (
          <div className={panelClass()}>
            <p className="text-sm text-gray-300/70">Loading catalog…</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={panelClass()}>
            <p className="text-sm text-gray-300/70">No products found.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredProducts.map((p) => {
              const isEditing = editingId === p.id;
              const imageUrl = p.imageUrl ? `${apiBase}${p.imageUrl}` : null;
              const stockMeta = stockChip(p.stock);

              return (
                <div
                  key={p.id}
                  className={panelClass(
                    "relative overflow-hidden border-white/10 hover:border-white/15 transition"
                  )}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.07] to-transparent" />

                  <div className="relative flex flex-col lg:flex-row gap-6">
                    {/* Image column */}
                    <div className="w-full lg:w-[240px] space-y-3">
                      <div className="w-full aspect-square rounded-[28px] overflow-hidden border border-white/10 bg-white/[0.03] shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
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

                      {/* ✅ Active + Category: 50% each, total width matches button */}
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <span className={chip(p.isActive === false ? "warn" : "muted") + " w-full justify-center"}>
                          {p.isActive === false ? "Inactive" : "Active"}
                        </span>

                        <span className={chip("muted") + " w-full justify-center truncate"}>
                          {getCategoryLabel(p.categoryId)}
                        </span>
                      </div>

                      {/* ✅ Other chips (stock + discount) */}
                      <div className="flex flex-wrap gap-2">
                        <span className={chip(stockMeta.tone)}>{stockMeta.label}</span>
                        {p.discountRate ? (
                          <span className={chip("warn")}>
                            {Number(p.discountRate).toFixed(2)}% off
                          </span>
                        ) : null}
                      </div>

                      <label
                        className={
                          btnBase +
                          " " +
                          btnGhost +
                          " w-full cursor-pointer px-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                        }
                      >
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

                    {/* Content */}
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1 min-w-0">
                          {isEditing ? (
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className={fieldBase + " w-full"}
                            />
                          ) : (
                            <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
                              {p.name}
                            </h2>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-300/60">
                            <span className="opacity-80">ID: {p.id}</span>
                            <span className="opacity-30">·</span>
                            <span className="opacity-80">Model: {p.model || "—"}</span>
                            <span className="opacity-30">·</span>
                            <span className="opacity-80">Serial: {p.serialNumber || "—"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-300/60 uppercase tracking-[0.18em]">
                                $
                              </span>
                              <input
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className={
                                  fieldBase +
                                  " w-28 text-right disabled:opacity-50 disabled:cursor-not-allowed"
                                }
                                disabled={isProductManager}
                                title={isProductManager ? "Only Sales Managers can edit price" : ""}
                              />
                            </div>
                          ) : (
                            <div className="flex items-baseline gap-2">
                              <p className="text-lg sm:text-xl font-semibold text-white">
                                ${Number(p.price || 0).toFixed(2)}
                              </p>
                            </div>
                          )}

                          {isEditing ? (
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
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                            Description
                          </p>
                          {!isEditing ? (
                            <span className="text-[11px] text-gray-300/40">
                              {p.description?.length ? `${p.description.length} chars` : "—"}
                            </span>
                          ) : null}
                        </div>

                        {isEditing ? (
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={4}
                            className={textAreaBase + " w-full mt-3"}
                          />
                        ) : (
                          <p className="text-sm text-gray-200/80 leading-relaxed mt-3">
                            {p.description || (
                              <span className="text-gray-300/50 italic">No description set.</span>
                            )}
                          </p>
                        )}

                        {isEditing && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60 mb-2">
                              Category
                            </p>
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className={selectFixClass + " w-full md:w-1/2"}
                            >
                              <option value="">Select Category</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
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
