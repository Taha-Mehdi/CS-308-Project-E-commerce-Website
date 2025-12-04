"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import ActionButton from "../../../components/ActionButton";
import StockBadge from "../../../components/StockBadge";
import { useAuth } from "../../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

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
  const [creating, setCreating] = useState(false);

  // Edit product
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Per-product image upload state
  const [imageUploadingId, setImageUploadingId] = useState(null);

  // Delete product
  const [deletingId, setDeletingId] = useState(null);

  function ensureAdmin() {
    if (!user || user.roleId !== 1) {
      setMessage("You do not have admin permissions.");
      return false;
    }
    return true;
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

  // Load products
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products`);
        if (!res.ok) {
          let msg = "Failed to load products.";
          const j = await safeJson(res);
          if (j?.message) msg = j.message;
          setMessage(msg);
          setProducts([]);
          setLoading(false);
          return;
        }

        const j = await safeJson(res);
        if (!Array.isArray(j)) {
          setMessage("Products format invalid.");
          setProducts([]);
          setLoading(false);
          return;
        }

        setProducts(j);
      } catch (err) {
        console.error("Admin load products error:", err);
        setMessage("Failed to load products.");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser && user && user.roleId === 1) {
      loadProducts();
    } else if (!loadingUser) {
      setLoading(false);
    }
  }, [apiBase, loadingUser, user]);

  // ---------- CREATE PRODUCT (with optional image) ----------

  async function handleCreateProduct(e) {
    e.preventDefault();
    if (!ensureAdmin()) return;

    let token = null;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || null;
    }
    if (!token) {
      setMessage("Please login as admin.");
      return;
    }

    const priceNumber = Number(newPrice);
    const stockNumber = Number(newStock);
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      setMessage("Price must be a non-negative number.");
      return;
    }
    if (!Number.isInteger(stockNumber) || stockNumber < 0) {
      setMessage("Stock must be a non-negative integer.");
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      // 1) Create product via JSON
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
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        console.error("Create product failed:", res.status, data);
        const msg =
          data?.message ||
          "Failed to create product. Please check fields and try again.";
        setMessage(msg);
        return;
      }

      const created = data;
      if (!created || !created.id) {
        setMessage("Product was created but response is incomplete.");
        return;
      }

      let finalProduct = created;

      // 2) If a new image file is selected, upload it
      if (newImageFile) {
        try {
          const imgRes = await uploadProductImage(created.id, newImageFile, token);
          if (imgRes && imgRes.product) {
            finalProduct = imgRes.product;
          }
        } catch (err) {
          console.error("Create product image upload error:", err);
          setMessage(
            "Product created, but image upload failed. You can retry from the product list."
          );
        }
      }

      // 3) Refresh local list
      setProducts((prev) => [finalProduct, ...prev]);

      // Reset form
      setNewName("");
      setNewPrice("");
      setNewStock("");
      setNewDescription("");
      setNewImageFile(null);
      setMessage("Product created successfully.");
    } catch (err) {
      console.error("Create product error:", err);
      setMessage("Something went wrong creating the product.");
    } finally {
      setCreating(false);
    }
  }

  async function uploadProductImage(productId, file, tokenFromCaller) {
    const token =
      tokenFromCaller ||
      (typeof window !== "undefined"
        ? localStorage.getItem("token") || null
        : null);

    if (!token) {
      throw new Error("Missing token for image upload.");
    }

    const formData = new FormData();
    formData.append("image", file);

    setImageUploadingId(productId);

    try {
      const res = await fetch(`${apiBase}/products/${productId}/image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await safeJson(res);

      if (!res.ok) {
        console.error("Upload image failed:", res.status, data);
        let msg =
          data?.message ||
          "Failed to upload image. Check file type/size and try again.";
        setMessage(msg);
        if (typeof window !== "undefined") window.alert(msg);
        return null;
      }

      if (data?.product) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? data.product : p))
        );
      }

      return data;
    } finally {
      setImageUploadingId(null);
    }
  }

  // ---------- EDIT PRODUCT ----------

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name || "");
    setEditPrice(String(p.price ?? ""));
    setEditStock(String(p.stock ?? ""));
    setEditDescription(p.description || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
    setEditStock("");
    setEditDescription("");
  }

  async function handleSaveEdit(productId) {
    if (!ensureAdmin()) return;

    let token = null;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || null;
    }
    if (!token) {
      setMessage("Please login as admin.");
      return;
    }

    const priceNumber = Number(editPrice);
    const stockNumber = Number(editStock);
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      setMessage("Price must be a non-negative number.");
      return;
    }
    if (!Number.isInteger(stockNumber) || stockNumber < 0) {
      setMessage("Stock must be a non-negative integer.");
      return;
    }

    setSavingEdit(true);
    setMessage("");

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
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        console.error("Update product failed:", res.status, data);
        const msg =
          data?.message ||
          "Failed to update product. Possibly referenced in orders or invalid data.";
        setMessage(msg);
        if (typeof window !== "undefined") window.alert(msg);
        return;
      }

      const updated = data;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? updated : p))
      );
      cancelEdit();
      setMessage("Product updated.");
    } catch (err) {
      console.error("Update product error:", err);
      const msg =
        "Something went wrong updating this product. If it is used in orders, some changes may be restricted.";
      setMessage(msg);
    } finally {
      setSavingEdit(false);
    }
  }

  // ---------- DELETE PRODUCT ----------

  async function handleDelete(productId) {
    if (!ensureAdmin()) return;

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Delete this product? If it is referenced in existing orders, deletion may fail."
      )
    ) {
      return;
    }

    let token = null;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || null;
    }
    if (!token) {
      setMessage("Please login as admin.");
      return;
    }

    setDeletingId(productId);
    setMessage("");

    try {
      const res = await fetch(`${apiBase}/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await safeJson(res);

      if (!res.ok) {
        console.error("Delete product failed:", res.status, data);
        const msg =
          data?.message ||
          "Could not delete product. It may be referenced in existing orders.";
        setMessage(msg);
        if (typeof window !== "undefined") window.alert(msg);
        return;
      }

      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setMessage("Product deleted.");
    } catch (err) {
      console.error("Delete product error:", err);
      const msg =
        "Server could not delete this product. It may be used in historical orders.";
      setMessage(msg);
      if (typeof window !== "undefined") window.alert(msg);
    } finally {
      setDeletingId(null);
    }
  }

  // ---------- AUTH GATES ----------

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking admin access…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
            Admin · Products
          </h1>
          <p className="text-sm text-gray-600 max-w-sm">
            You need to be logged in as an admin to manage drops.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-semibold uppercase tracking-[0.18em] text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (user.roleId !== 1) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
            Admin · Products
          </h1>
          <p className="text-sm text-gray-600">
            Your account does not have admin permissions.
          </p>
          <Link
            href="/"
            className="inline-flex text-xs text-gray-800 underline underline-offset-4 mt-2"
          >
            Back to homepage
          </Link>
        </div>
      </SiteLayout>
    );
  }

  // ---------- MAIN UI ----------

  return (
    <SiteLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up · Admin
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
              Product catalog
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Create, tune, and visually stage every drop in the SNEAKS-UP
              lineup.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black"
          >
            Back to admin dashboard
          </Link>
        </div>

        {/* Message */}
        {message && (
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 text-xs text-gray-800">
            {message}
          </div>
        )}

        {/* Create product form */}
        <form
          onSubmit={handleCreateProduct}
          className="rounded-3xl border border-gray-200 bg-white/95 shadow-sm shadow-black/5 px-4 py-4 sm:px-6 sm:py-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                New drop
              </p>
              <p className="text-xs text-gray-500">
                Add a new pair to the SNEAKS-UP catalog. Image is optional but
                highly recommended.
              </p>
            </div>
            <span className="text-[11px] text-gray-400">
              Fields marked * are required
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Name *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full rounded-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/15"
                placeholder="Air Burst Retro 'Night Fade'"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required
                  className="w-full rounded-full border border-gray-300 bg-white pl-6 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/15"
                  placeholder="129.00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Stock *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                required
                className="w-full rounded-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/15"
                placeholder="24"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Description
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/15 resize-none"
                placeholder="Story the drop — colorway, fit, materials, and why it hits different."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                Product image
              </label>
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 px-3 py-3 flex flex-col gap-2 justify-between h-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setNewImageFile(e.target.files?.[0] || null)
                  }
                  className="text-[11px] text-gray-700 file:text-[11px] file:px-3 file:py-1.5 file:rounded-full file:border file:border-gray-300 file:bg-white file:text-gray-800 file:mr-3 file:hover:bg-gray-100"
                />
                <p className="text-[11px] text-gray-500 leading-snug">
                  Optional. JPEG/PNG recommended. You can also upload or change
                  imagery later from the product list.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <ActionButton
              type="submit"
              disabled={creating}
              size="xs"
              variant="info"
              className="gap-2 px-4 shadow-sm"
            >
              {creating ? "Creating…" : "Create drop"}
            </ActionButton>
          </div>
        </form>

        {/* Existing products list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-900">
              Catalog ({products.length})
            </p>
            <p className="text-[11px] text-gray-500">
              Click a card to update copy, price, stock, or imagery.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-gray-500">
              No products yet. Start by creating your first drop above.
            </p>
          ) : (
            <div className="space-y-3">
              {products.map((p) => {
                const isEditing = editingId === p.id;
                const priceNumber = Number(p.price || 0);
                const imageUrl = p.imageUrl
                  ? `${apiBase}${p.imageUrl}`
                  : null;

                const activeLabel = p.isActive === false ? "Inactive" : "Active";
                const activeClasses =
                  p.isActive === false
                    ? "bg-gray-200 text-gray-700"
                    : "bg-emerald-100 text-emerald-700";

                return (
                  <div
                    key={p.id}
                    className="rounded-3xl border border-gray-200 bg-white/95 px-4 py-4 sm:px-5 sm:py-5 shadow-sm shadow-black/5"
                  >
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Image preview + upload */}
                      <div className="flex flex-col items-center gap-2 md:w-40">
                        <div className="w-32 h-32 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center shadow-sm">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={p.name || "Drop image"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 text-center px-2">
                              No image yet
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={imageUploadingId === p.id}
                          className="relative overflow-hidden rounded-full border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                          <label className="cursor-pointer">
                            <span>
                              {imageUploadingId === p.id
                                ? "Uploading…"
                                : imageUrl
                                ? "Replace image"
                                : "Upload image"}
                            </span>
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
                                  console.error(
                                    "Inline image upload error:",
                                    err
                                  );
                                }
                              }}
                            />
                          </label>
                        </button>
                        <span
                          className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${activeClasses}`}
                        >
                          {activeLabel}
                        </span>
                      </div>

                      {/* Text & controls */}
                      <div className="flex-1 space-y-3">
                        {/* Top row: name + price + stock */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) =>
                                  setEditName(e.target.value)
                                }
                                className="w-full rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/15"
                              />
                            ) : (
                              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                                {p.name}
                              </h2>
                            )}
                            <p className="text-[11px] text-gray-500">
                              ID: {p.id}
                            </p>
                          </div>
                            <div className="text-right space-y-1">
                              <div>
                                <span className="text-xs font-semibold text-gray-900">
                                  $
                                  {isEditing
                                    ? Number(editPrice || 0).toFixed(2)
                                    : priceNumber.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-end">
                                {isEditing ? (
                                  <span className="text-[11px] text-gray-700 font-medium">
                                    In stock: {editStock}
                                  </span>
                                ) : (
                                  <StockBadge
                                    stock={p.stock}
                                    tone="muted"
                                    className="text-[10px] px-2.5 py-1"
                                  />
                                )}
                              </div>
                            </div>
                        </div>

                        {/* Description + editable price/stock fields when editing */}
                        <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                              Description
                            </p>
                            {isEditing ? (
                              <textarea
                                value={editDescription}
                                onChange={(e) =>
                                  setEditDescription(e.target.value)
                                }
                                rows={2}
                                className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/15 resize-none"
                              />
                            ) : (
                              <p className="text-xs text-gray-600 leading-relaxed">
                                {p.description || (
                                  <span className="italic text-gray-400">
                                    No description set.
                                  </span>
                                )}
                              </p>
                            )}
                          </div>

                          {isEditing && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                                  Price
                                </p>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                    $
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editPrice}
                                    onChange={(e) =>
                                      setEditPrice(e.target.value)
                                    }
                                    className="w-full rounded-full border border-gray-300 bg-white pl-6 pr-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/15"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                                  Stock
                                </p>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={editStock}
                                  onChange={(e) =>
                                    setEditStock(e.target.value)
                                  }
                                  className="w-full rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/15"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Edit / delete controls */}
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(p.id)}
                                disabled={savingEdit}
                                className="px-3.5 py-1.75 rounded-full bg-black text-white text-[11px] font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                              >
                                {savingEdit ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="px-3.5 py-1.75 rounded-full border border-gray-300 bg-white text-[11px] font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(p)}
                                className="px-3.5 py-1.75 rounded-full border border-gray-300 bg-white text-[11px] font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(p.id)}
                                disabled={deletingId === p.id}
                                className="px-3.5 py-1.75 rounded-full bg-red-600 text-white text-[11px] font-semibold uppercase tracking-[0.18em] hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
    </SiteLayout>
  );
}
