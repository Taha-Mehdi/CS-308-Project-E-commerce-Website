"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import SiteLayout from "../../../components/SiteLayout";
import ActionButton from "../../../components/ActionButton";
import StockBadge from "../../../components/StockBadge";
import { useAuth } from "../../../context/AuthContext";
import { applyDiscountApi } from "../../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

// Fixed categories for this project
const CATEGORY_OPTIONS = [
  { id: 1, label: "Low Top" },
  { id: 2, label: "Mid Top" },
  { id: 3, label: "High Top" },
];

function getCategoryLabel(categoryId) {
  const num = Number(categoryId);
  if (!num) return "Uncategorized";
  const found = CATEGORY_OPTIONS.find((opt) => opt.id === num);
  return found ? found.label : `Category #${num}`;
}

function chipBase() {
  return "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";
}
function chip(tone = "muted") {
  const base = chipBase();
  if (tone === "live") return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (tone === "warn") return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (tone === "danger") return `${base} border-red-500/25 bg-red-500/10 text-red-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function panelClass() {
  return "rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
}

export default function AdminProductsPage() {
  const { user, loadingUser } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Create product form (ADMIN ONLY)
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

  // Edit product (ADMIN ONLY)
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

  // Per-product image upload state (ADMIN ONLY)
  const [imageUploadingId, setImageUploadingId] = useState(null);

  // Delete product (ADMIN ONLY)
  const [deletingId, setDeletingId] = useState(null);

  // Reviews (ADMIN ONLY)
  const [pendingReviews, setPendingReviews] = useState([]);

  // ---- Role helpers
  function isAdmin() {
    return !!user && user.roleId === 1;
  }

  function isSalesManager() {
    // Based on your roles insertion order:
    // 1 admin, 2 customer, 3 support, 4 sales_manager, 5 product_manager
    return !!user && (user.roleId === 4 || user.roleId === 1);
  }

  function ensureAdmin() {
    if (!isAdmin()) {
      setMessage("You do not have admin permissions.");
      return false;
    }
    return true;
  }

  // ---- Discounts (Sales manager + Admin)
  const canUseDiscounts = useMemo(() => isSalesManager(), [user]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [discountPct, setDiscountPct] = useState(""); // e.g. "15"
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelected() {
    setSelectedIds(new Set());
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

  // Load products AND pending reviews (reviews only if admin)
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setMessage("");

      if (!user || (!isAdmin() && !isSalesManager())) {
        setLoading(false);
        return;
      }

      const token =
        typeof window !== "undefined" ? window.localStorage.getItem("token") : null;

      try {
        // Products
        const prodRes = await fetch(`${apiBase}/products`);
        if (prodRes.ok) {
          const j = await safeJson(prodRes);
          if (Array.isArray(j)) setProducts(j);
        }

        // Pending reviews (admin only)
        if (isAdmin() && token) {
          const revRes = await fetch(`${apiBase}/reviews/pending`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (revRes.ok) {
            const reviewsData = await revRes.json();
            setPendingReviews(Array.isArray(reviewsData) ? reviewsData : []);
          }
        }
      } catch (err) {
        console.error("Admin load error:", err);
        setMessage("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser) loadData();
  }, [apiBase, loadingUser, user]);

  // ---- Apply discount to selection
  async function applyDiscountToSelected(rate) {
    if (!canUseDiscounts) {
      setMessage("Sales manager access required to apply discounts.");
      return;
    }

    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setMessage("Select at least one product.");
      return;
    }

    const r = Number(rate);
    if (Number.isNaN(r) || r < 0 || r > 1) {
      setMessage("Discount must be between 0% and 100%.");
      return;
    }

    setApplyingDiscount(true);
    setMessage("");

    try {
      await applyDiscountApi({ productIds: ids, discountRate: r });
      setMessage(r === 0 ? "Discount cleared." : "Discount applied.");
    } catch (err) {
      console.error("Apply discount error:", err);
      setMessage(err?.message || "Failed to apply discount.");
    } finally {
      setApplyingDiscount(false);
    }
  }

  // ---------- CREATE PRODUCT (ADMIN ONLY, with optional image) ----------
  async function handleCreateProduct(e) {
    e.preventDefault();
    if (!ensureAdmin()) return;

    let token = null;
    if (typeof window !== "undefined") token = window.localStorage.getItem("token") || null;

    if (!token) {
      setMessage("Please login as admin.");
      return;
    }

    const priceNumber = Number(newPrice);
    const stockNumber = Number(newStock);

    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      setMessage("Price must be a valid number.");
      return;
    }
    if (!Number.isInteger(stockNumber) || stockNumber < 0) {
      setMessage("Stock must be a valid integer.");
      return;
    }

    const categoryId = newCategory ? Number(newCategory) : null;

    setCreating(true);
    setMessage("");

    try {
      const res = await fetch(`${apiBase}/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName,
          description: newDescription || "",
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

      const data = await safeJson(res);

      if (!res.ok) {
        setMessage(data?.message || "Failed to create product.");
        return;
      }

      const created = data;
      let finalProduct = created;

      // If a new image file is selected, upload it
      if (newImageFile && created.id) {
        try {
          const imgRes = await uploadProductImage(created.id, newImageFile, token);
          if (imgRes && imgRes.product) finalProduct = imgRes.product;
        } catch (err) {
          console.error("Image upload failed", err);
        }
      }

      setProducts((prev) => [finalProduct, ...prev]);

      // Reset form
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
      setMessage("Product created successfully.");
    } catch (err) {
      console.error("Create product error:", err);
      setMessage("Something went wrong creating the product.");
    } finally {
      setCreating(false);
    }
  }

  // ---------- IMAGE UPLOAD (ADMIN ONLY) ----------
  async function uploadProductImage(productId, file, tokenFromCaller) {
    let token = tokenFromCaller || null;
    if (!token && typeof window !== "undefined") {
      token = window.localStorage.getItem("token") || null;
    }

    if (!token) {
      setMessage("Please login as admin to upload product images.");
      return null;
    }

    const formData = new FormData();
    formData.append("image", file);
    setImageUploadingId(productId);

    try {
      const res = await fetch(`${apiBase}/products/${productId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setMessage(data?.message || "Failed to upload image.");
        return null;
      }

      if (data?.product) {
        setProducts((prev) => prev.map((p) => (p.id === productId ? data.product : p)));
      }

      return data;
    } catch (err) {
      console.error("Upload product image error:", err);
      setMessage("Failed to upload image.");
      return null;
    } finally {
      setImageUploadingId(null);
    }
  }

  // ---------- REVIEW ACTIONS (ADMIN ONLY) ----------
  async function handleReviewAction(id, action) {
    if (!isAdmin()) return;

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) return;

    try {
      if (action === "approved") {
        const res = await fetch(`${apiBase}/reviews/${id}/approve`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setPendingReviews((prev) => prev.filter((r) => r.id !== id));
          setMessage("Review approved!");
        } else {
          setMessage("Failed to approve review.");
        }
      } else if (action === "rejected") {
        const res = await fetch(`${apiBase}/reviews/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setPendingReviews((prev) => prev.filter((r) => r.id !== id));
          setMessage("Review rejected (deleted).");
        }
      }
    } catch (err) {
      console.error("Review action error", err);
    }
  }

  // ---------- EDIT PRODUCT (ADMIN ONLY) ----------
  function startEdit(p) {
    if (!isAdmin()) return;
    setEditingId(p.id);
    setEditName(p.name || "");
    setEditPrice(String(p.price ?? ""));
    setEditStock(String(p.stock ?? ""));
    setEditDescription(p.description || "");
    setEditModel(p.model || "");
    setEditSerialNumber(p.serialNumber || "");
    setEditWarrantyStatus(p.warrantyStatus || "");
    setEditDistributorInfo(p.distributorInfo || "");
    setEditCategory(
      p.categoryId !== null && p.categoryId !== undefined ? String(p.categoryId) : ""
    );
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

  async function handleSaveEdit(productId) {
    if (!ensureAdmin()) return;

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) {
      setMessage("Please login as admin.");
      return;
    }

    const stockNumber = Number(editStock);
    if (!Number.isInteger(stockNumber) || stockNumber < 0) {
      setMessage("Stock must be a valid non-negative integer.");
      return;
    }

    const priceNumber = Number(editPrice);
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      setMessage("Price must be a valid number.");
      return;
    }

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

      if (res.ok) {
        const data = await res.json();
        setProducts((prev) => prev.map((p) => (p.id === productId ? data : p)));
        cancelEdit();
        setMessage("Product updated.");
      } else {
        const data = await safeJson(res);
        setMessage(data?.message || "Update failed");
      }
    } catch {
      setMessage("Update failed");
    } finally {
      setSavingEdit(false);
    }
  }

  // ---------- DELETE PRODUCT (ADMIN ONLY) ----------
  async function handleDelete(productId) {
    if (!ensureAdmin()) return;
    if (!confirm("Delete this product?")) return;

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) {
      setMessage("Please login as admin.");
      return;
    }

    setDeletingId(productId);
    try {
      const res = await fetch(`${apiBase}/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        setMessage("Product deleted.");
      } else {
        const data = await safeJson(res);
        setMessage(data?.message || "Delete failed");
      }
    } catch {
      setMessage("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  // ---------- SEARCH / FILTER ----------
  const [query, setQuery] = useState("");
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = `${p.name || ""} ${p.description || ""} ${p.model || ""} ${p.serialNumber || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, query]);

  // ---------- UI RENDER ----------
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-300/70">Checking access…</p>
      </SiteLayout>
    );
  }

  if (!user || (!isAdmin() && !isSalesManager())) {
    return (
      <SiteLayout>
        <div className="space-y-4 py-6">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Admin
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Access denied
          </h1>
          <p className="text-sm text-gray-300/70">
            You need admin or sales manager permissions to view this page.
          </p>
          <DripLink
            href="/"
            className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
          >
            Back to homepage
          </DripLink>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="space-y-8 py-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Sneaks-up · Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Product catalog
            </h1>
            <p className="text-sm text-gray-300/70">
              {isAdmin()
                ? "Create drops, manage stock, and approve reviews."
                : "Select products and apply discounts."}
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <span className={chip("muted")}>{products.length} products</span>
              {isAdmin() && (
                <span className={chip(pendingReviews.length ? "warn" : "muted")}>
                  {pendingReviews.length} pending reviews
                </span>
              )}
              <span className={chip("live")}>
                Role: {user?.roleId === 4 ? "sales_manager" : "admin"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DripLink
              href="/admin"
              className="h-10 px-5 inline-flex items-center justify-center rounded-full border border-border bg-white/5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10 transition active:scale-[0.98]"
            >
              Back to dashboard
            </DripLink>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
            {message}
          </div>
        )}

        {/* DISCOUNT PANEL (Sales manager + Admin) */}
        {canUseDiscounts && (
          <div className={panelClass()}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                  Discounts (Sales)
                </p>
                <p className="text-sm text-gray-200/80">
                  Select products below and apply a discount rate.
                </p>
                <div className="pt-2 flex flex-wrap gap-2">
                  <span className={chip("muted")}>{selectedIds.size} selected</span>
                  <span className={chip("live")}>
                    Role: {user?.roleId === 4 ? "sales_manager" : "admin"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  placeholder="Discount % (e.g. 15)"
                  className="h-10 w-52 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15"
                />

                <button
                  type="button"
                  disabled={applyingDiscount}
                  onClick={() => {
                    const pct = Number(discountPct);
                    const r = pct / 100;
                    applyDiscountToSelected(r);
                  }}
                  className="
                    h-10 px-5 rounded-full
                    bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                    text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                    hover:opacity-95 transition active:scale-[0.98]
                    disabled:opacity-60 disabled:cursor-not-allowed
                  "
                >
                  {applyingDiscount ? "Applying…" : "Apply"}
                </button>

                <button
                  type="button"
                  disabled={applyingDiscount}
                  onClick={() => applyDiscountToSelected(0)}
                  className="
                    h-10 px-5 rounded-full border border-border bg-white/5
                    text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100
                    hover:bg-white/10 transition active:scale-[0.98]
                    disabled:opacity-60 disabled:cursor-not-allowed
                  "
                >
                  Clear discount
                </button>

                <button
                  type="button"
                  onClick={clearSelected}
                  className="
                    h-10 px-5 rounded-full border border-border bg-white/5
                    text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100
                    hover:bg-white/10 transition active:scale-[0.98]
                  "
                >
                  Clear selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PENDING REVIEWS (ADMIN ONLY) */}
        {isAdmin() && (
          <div className={panelClass()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                  Pending reviews
                </p>
                <p className="text-sm text-gray-200/80 mt-1">
                  Approve comments to make them visible.
                </p>
              </div>
              <span className={chip(pendingReviews.length ? "warn" : "muted")}>
                {pendingReviews.length} waiting
              </span>
            </div>

            <div className="mt-4">
              {pendingReviews.length === 0 ? (
                <p className="text-sm text-gray-300/70">No pending reviews.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {pendingReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-[24px] border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white">
                            Review #{rev.id}
                          </p>
                          <p className="text-[11px] text-gray-300/60">
                            User: {rev.userId} · Product: {rev.productId}
                          </p>
                        </div>
                        <span className={chip("muted")}>
                          {"★"
                            .repeat(Math.max(1, Math.min(5, rev.rating || 1)))
                            .padEnd(5, "☆")}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-gray-200/80 italic">
                        “{rev.comment}”
                      </p>

                      <div className="mt-3 flex items-center gap-2">
                        <ActionButton
                          size="xs"
                          variant="success"
                          onClick={() => handleReviewAction(rev.id, "approved")}
                        >
                          Approve
                        </ActionButton>
                        <ActionButton
                          size="xs"
                          variant="outline"
                          onClick={() => handleReviewAction(rev.id, "rejected")}
                        >
                          Reject
                        </ActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CREATE PRODUCT (ADMIN ONLY) */}
        {isAdmin() && (
          <form onSubmit={handleCreateProduct} className={panelClass()}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                  New drop
                </p>
                <p className="text-sm text-gray-200/80 mt-1">
                  Add a new pair to the catalog. Image is optional.
                </p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="
                  h-10 px-6 rounded-full
                  bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                  text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                  hover:opacity-95 transition active:scale-[0.98]
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              >
                {creating ? "Creating…" : "Create product"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Name *
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15"
                  placeholder="Air Burst Retro 'Night Fade'"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Price *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required
                  className="w-full h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15"
                  placeholder="129.00"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Stock *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  required
                  className="w-full h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15"
                  placeholder="24"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-11 rounded-full border border-white/10 bg-white/5 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100 focus:outline-none focus:ring-2 focus:ring-white/15"
                >
                  <option value="">Select</option>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={String(opt.id)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15 resize-none"
                  placeholder="Story the drop — fit, materials, and why it hits different."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-gray-200 file:text-[11px] file:px-4 file:py-2 file:rounded-full file:border file:border-white/10 file:bg-white/5 file:text-gray-100 file:mr-3 file:hover:bg-white/10"
                />
                <p className="text-[11px] text-gray-300/55 leading-snug">
                  Optional. Recommended for clean product cards.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Model
                </label>
                <input
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="w-full h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15"
                  placeholder="SB Dunk"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Serial number
                </label>
                <input
                  value={newSerialNumber}
                  onChange={(e) => setNewSerialNumber(e.target.value)}
                  className="w-full h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15"
                  placeholder="Manufacturer code"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Warranty
                </label>
                <input
                  value={newWarrantyStatus}
                  onChange={(e) => setNewWarrantyStatus(e.target.value)}
                  className="w-full h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15"
                  placeholder="1 year official"
                />
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                  Distributor
                </label>
                <input
                  value={newDistributorInfo}
                  onChange={(e) => setNewDistributorInfo(e.target.value)}
                  className="w-full h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15"
                  placeholder="Sneaks-Up TR"
                />
              </div>
            </div>
          </form>
        )}

        {/* CATALOG HEADER */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
              Catalog
            </p>
            <p className="text-sm text-gray-200/80">
              {isAdmin()
                ? "Edit drops, update stock, replace imagery."
                : "Select products (checkbox) then apply discount above."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, model, serial..."
              className="h-10 w-full md:w-72 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/15"
            />
            <span className={chip("muted")}>{filteredProducts.length} shown</span>
          </div>
        </div>

        {/* PRODUCT LIST */}
        {loading ? (
          <div className={panelClass()}>
            <p className="text-sm text-gray-300/70">Loading products…</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={panelClass()}>
            <p className="text-sm text-gray-300/70">
              No products match your search.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((p) => {
              const isEditing = editingId === p.id;
              const imageUrl = p.imageUrl ? `${apiBase}${p.imageUrl}` : null;

              const activeLabel = p.isActive === false ? "Inactive" : "Active";

              return (
                <div key={p.id} className={panelClass()}>
                  <div className="flex flex-col lg:flex-row gap-5">
                    {/* IMAGE */}
                    <div className="flex flex-col items-start gap-2 w-full lg:w-[220px]">
                      <div className="w-full aspect-square rounded-[24px] overflow-hidden border border-white/10 bg-white/5">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={p.name || "Drop image"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] uppercase tracking-[0.28em] text-gray-300/50">
                            No image
                          </div>
                        )}
                      </div>

                      {/* Replace image (ADMIN ONLY) */}
                      {isAdmin() && (
                        <button
                          type="button"
                          disabled={imageUploadingId === p.id}
                          className="
                            w-full h-10 rounded-full border border-border bg-white/5
                            text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100
                            hover:bg-white/10 transition active:scale-[0.98]
                            disabled:opacity-60 disabled:cursor-not-allowed
                          "
                        >
                          <label className="w-full h-full flex items-center justify-center cursor-pointer">
                            {imageUploadingId === p.id
                              ? "Uploading…"
                              : imageUrl
                              ? "Replace image"
                              : "Upload image"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0] || null;
                                if (!file) return;
                                try {
                                  await uploadProductImage(p.id, file);
                                } catch (err) {
                                  console.error("Inline image upload error:", err);
                                }
                              }}
                            />
                          </label>
                        </button>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <span className={chip("muted")}>{activeLabel}</span>
                        <span className={chip("muted")}>{getCategoryLabel(p.categoryId)}</span>
                      </div>
                    </div>

                    {/* INFO */}
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          {/* Selection checkbox (Sales + Admin) */}
                          {canUseDiscounts && (
                            <label className="inline-flex items-center gap-2 text-[11px] text-gray-200/70">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(p.id)}
                                onChange={() => toggleSelected(p.id)}
                                className="accent-white"
                              />
                              select
                            </label>
                          )}

                          {isEditing ? (
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
                            />
                          ) : (
                            <h2 className="text-lg font-semibold text-white truncate">
                              {p.name}
                            </h2>
                          )}

                          <p className="text-[11px] text-gray-300/60">
                            ID: {p.id} · Model: {p.model || "—"} · Serial: {p.serialNumber || "—"}
                          </p>
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
                                className="h-11 w-28 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-white/15"
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
                              tone="muted"
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
                                className="h-11 w-24 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-white/15"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* DESCRIPTION */}
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                          Description
                        </p>
                        {isEditing ? (
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={3}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15 resize-none"
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

                      {/* SPECS */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-[20px] border border-white/10 bg-white/5 p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-300/60">
                            Warranty
                          </p>
                          {isEditing ? (
                            <input
                              value={editWarrantyStatus}
                              onChange={(e) => setEditWarrantyStatus(e.target.value)}
                              className="mt-2 w-full h-10 rounded-full border border-white/10 bg-black/20 px-4 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-white/15"
                            />
                          ) : (
                            <p className="mt-2 text-sm text-gray-200/80">
                              {p.warrantyStatus || "Standard"}
                            </p>
                          )}
                        </div>

                        <div className="rounded-[20px] border border-white/10 bg-white/5 p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-300/60">
                            Distributor
                          </p>
                          {isEditing ? (
                            <input
                              value={editDistributorInfo}
                              onChange={(e) => setEditDistributorInfo(e.target.value)}
                              className="mt-2 w-full h-10 rounded-full border border-white/10 bg-black/20 px-4 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-white/15"
                            />
                          ) : (
                            <p className="mt-2 text-sm text-gray-200/80 truncate">
                              {p.distributorInfo || "Official store"}
                            </p>
                          )}
                        </div>

                        <div className="rounded-[20px] border border-white/10 bg-white/5 p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-300/60">
                            Category
                          </p>
                          {isEditing ? (
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="mt-2 w-full h-10 rounded-full border border-white/10 bg-black/20 px-4 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-white/15"
                            >
                              <option value="">Uncategorized</option>
                              {CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.id} value={String(opt.id)}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="mt-2 text-sm text-gray-200/80">
                              {getCategoryLabel(p.categoryId)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ACTIONS (ADMIN ONLY) */}
                      {isAdmin() && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/10">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(p.id)}
                                disabled={savingEdit}
                                className="
                                  h-10 px-5 rounded-full
                                  bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                                  text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                                  hover:opacity-95 transition active:scale-[0.98]
                                  disabled:opacity-60 disabled:cursor-not-allowed
                                "
                              >
                                {savingEdit ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="
                                  h-10 px-5 rounded-full border border-border bg-white/5
                                  text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100
                                  hover:bg-white/10 transition active:scale-[0.98]
                                "
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(p)}
                                className="
                                  h-10 px-5 rounded-full border border-border bg-white/5
                                  text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100
                                  hover:bg-white/10 transition active:scale-[0.98]
                                "
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(p.id)}
                                disabled={deletingId === p.id}
                                className="
                                  h-10 px-5 rounded-full bg-red-600
                                  text-[11px] font-semibold uppercase tracking-[0.18em] text-white
                                  hover:bg-red-700 transition active:scale-[0.98]
                                  disabled:opacity-60 disabled:cursor-not-allowed
                                "
                              >
                                {deletingId === p.id ? "Deleting…" : "Delete"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
