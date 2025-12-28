"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import StockBadge from "../../../components/StockBadge";
import { useAuth } from "../../../context/AuthContext";
import { clearStoredTokens } from "../../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

// ... (keep panelClass, chipBase, chip, fieldBase, textAreaBase, btnBase, btnPrimary, btnGhost, btnDanger as is)
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
  const [isError, setIsError] = useState(false);

  /* --- Category Management State --- */
  const [showCatManager, setShowCatManager] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState("");

  // Toggle State
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Review Manager State
  const [showReviewManager, setShowReviewManager] = useState(false);
  const [pendingReviews, setPendingReviews] = useState([]);

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

  const [imageUploadingId, setImageUploadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const isAdmin = user?.roleName === "admin";
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

  /* --- Category Actions --- */
  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    try {
      const res = await fetch(`${apiBase}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newCatName }),
      });
      if (res.ok) {
        const cat = await res.json();
        setCategories((prev) => [...prev, cat]);
        setNewCatName("");
        setMsg("Category added.");
      } else {
        setMsg("Failed to add category.", true);
      }
    } catch (e) {
      console.error(e);
      setMsg("Error adding category.", true);
    }
  }

  async function handleDeleteCategory(id) {
    if (!confirm("Delete category? It might still be used by products.")) return;
    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    try {
      const res = await fetch(`${apiBase}/categories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        setMsg("Category deleted.");
      } else {
        setMsg("Could not delete category (maybe in use).", true);
      }
    } catch (e) {
      console.error(e);
      setMsg("Error deleting category.", true);
    }
  }

  /* --- Review Actions --- */
  async function handleApproveReview(id) {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    try {
      const res = await fetch(`${apiBase}/reviews/${id}/approve`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPendingReviews(prev => prev.filter(r => r.id !== id));
        setMsg("Review approved.");
      } else {
        setMsg("Failed to approve.", true);
      }
    } catch (e) {
      setMsg("Error approving review.", true);
    }
  }

  // ✅ Updated: Calls DELETE but backend ensures only text is removed
  async function handleDeleteReview(id) {
    if(!confirm("Remove review text? (Star rating will remain publicly visible)")) return;
    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    try {
      const res = await fetch(`${apiBase}/reviews/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPendingReviews(prev => prev.filter(r => r.id !== id));
        setMsg("Review text removed, rating approved.");
      } else {
        setMsg("Failed to remove review text.", true);
      }
    } catch (e) {
      setMsg("Error handling review.", true);
    }
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

        try {
          const catRes = await fetch(`${apiBase}/categories`);
          if (catRes.ok) {
            setCategories(await catRes.json());
          }
        } catch (e) {
          console.error("Failed to load categories", e);
        }

        if (token && (isAdmin || isProductManager)) {
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
        setMsg("Failed to load catalog.", true);
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser) loadData();
  }, [loadingUser, user, canEditCatalog, isAdmin, isProductManager]);

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

  async function handleCreate() {
    if (!canEditCatalog) {
      setMsg("You do not have permissions to add products.", true);
      return;
    }

    const token =
        typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (!token) {
      setMsg("Please login.", true);
      return;
    }

    const priceNumber = Number(newPrice);
    const stockNumber = Number(newStock);

    if (!newName.trim()) return setMsg("Product name is required.", true);
    if (Number.isNaN(priceNumber) || priceNumber < 0)
      return setMsg("Price must be a valid number.", true);
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

      if (handleAuthRedirectFromResponse(res, "/admin/products")) return;

      if (!res.ok) {
        const data = await safeJson(res);
        setMsg(data?.message || "Create failed", true);
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

      setShowAddProduct(false);
      setMsg("Product created.");
    } catch (err) {
      console.error("Create product error:", err);
      if (handleAuthRedirectFromError(err, "/admin/products")) return;
      setMsg("Create failed", true);
    } finally {
      setCreating(false);
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

          {message && !showAddProduct && (
              <div className={`rounded-2xl border px-4 py-3 text-[11px] font-medium ${isError ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'}`}>
                {message}
              </div>
          )}

          {/* ✅ BUTTONS ON LEFT */}
          <div className="flex flex-wrap gap-3">
            <button
                onClick={() => {
                  setShowCatManager(!showCatManager);
                  setShowReviewManager(false);
                }}
                className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
                    showCatManager
                        ? "bg-white text-black border-white shadow-xl scale-105"
                        : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/20"
                }`}
            >
              {showCatManager ? "Close Categories" : "Categories"}
            </button>

            <button
                onClick={() => {
                  setShowReviewManager(!showReviewManager);
                  setShowCatManager(false);
                }}
                className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
                    showReviewManager
                        ? "bg-white text-black border-white shadow-xl scale-105"
                        : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/20"
                }`}
            >
              {showReviewManager ? "Close Reviews" : `Reviews (${pendingReviews.length})`}
            </button>

            <button
                onClick={() => setShowAddProduct(!showAddProduct)}
                className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
                    showAddProduct
                        ? "bg-white text-black border-white shadow-xl scale-105"
                        : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/20"
                }`}
            >
              {showAddProduct ? "Cancel Adding" : "Add Product"}
            </button>
          </div>

          {/* --- Review Manager Panel --- */}
          {showReviewManager && (
              <div className={panelClass() + " space-y-4 border-amber-500/20"}>
                <h3 className="text-sm font-bold uppercase tracking-widest text-amber-200/70">
                  Pending Reviews
                </h3>
                {pendingReviews.length === 0 ? (
                    <p className="text-xs text-white/40 italic">No pending reviews.</p>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {pendingReviews.map(r => (
                          <div key={r.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold text-white">UserID: {r.userId}</span>
                              <span className="text-[10px] text-amber-200 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                        {r.rating} / 5 stars
                                    </span>
                            </div>
                            <p className="text-xs text-gray-300 italic">"{r.comment || 'No comment'}"</p>
                            <div className="mt-2 flex gap-2 justify-end">
                              <button
                                  onClick={() => handleApproveReview(r.id)}
                                  className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-200 px-3 py-1.5 rounded-full hover:bg-emerald-500/30"
                              >
                                Approve
                              </button>
                              <button
                                  onClick={() => handleDeleteReview(r.id)}
                                  className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-200 px-3 py-1.5 rounded-full hover:bg-red-500/30"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                      ))}
                    </div>
                )}
              </div>
          )}

          {/* --- Category Manager Panel --- */}
          {showCatManager && (
              <div className={panelClass() + " space-y-4 border-emerald-500/20"}>
                <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-300/70">
                  Categories
                </h3>
                <div className="flex gap-2 max-w-md">
                  <input
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="New category name"
                      className={fieldBase}
                  />
                  <button
                      onClick={handleAddCategory}
                      className={btnBase + " " + btnPrimary}
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {categories.map((c) => (
                      <div
                          key={c.id}
                          className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10"
                      >
                  <span className="text-xs text-white/80">
                    {c.name} <span className="opacity-50">(ID: {c.id})</span>
                  </span>
                        <button
                            onClick={() => handleDeleteCategory(c.id)}
                            className="text-red-400 hover:text-red-200 ml-1 font-bold text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>
                  ))}
                  {categories.length === 0 && (
                      <div className="text-xs text-white/40 italic">
                        No categories found.
                      </div>
                  )}
                </div>
              </div>
          )}

          {/* ADD PRODUCT FORM */}
          {showAddProduct && (
              <div className={panelClass() + " border-white/20"}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/90">
                      New Product Entry
                    </p>
                    <p className="mt-1 text-[12px] text-gray-300/60">
                      All fields are mandatory.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={chip("ok")}>Active</span>
                  </div>
                </div>

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
                          className={fieldBase + " bg-black/20"}
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
                          <p className="text-[11px] font-semibold text-white/90">
                            Product image *
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                            {newImageFile ? (
                                <span className="text-emerald-300">{newImageFile.name}</span>
                            ) : (
                                "No file chosen"
                            )}
                          </p>
                        </div>

                        <label
                            className={`${btnBase} ${btnGhost} h-9 px-4 text-[10px] cursor-pointer`}
                        >
                          Choose file
                          <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) =>
                                  setNewImageFile(e.target.files?.[0] || null)
                              }
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-white/10 pt-6">
                  <div className="flex-1">
                    {message && showAddProduct && (
                        <span className={`text-xs font-medium animate-pulse ${isError ? "text-red-400" : "text-emerald-400"}`}>
                      {isError ? "⚠️ " : "✓ "} {message}
                    </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setShowAddProduct(false)}
                        className={btnBase + " " + btnGhost}
                        disabled={creating}
                    >
                      Cancel
                    </button>

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
          )}

          {/* Search & List */}
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
                              <span className={chip("muted")}>
                          {getCategoryLabel(p.categoryId)}
                        </span>
                              {p.discountRate ? (
                                  <span className={chip("warn")}>
                            {Number(p.discountRate).toFixed(2)}% off
                          </span>
                              ) : null}
                            </div>

                            <label
                                className={
                                    btnBase + " " + btnGhost + " w-full cursor-pointer px-4"
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
                                    <h2 className="text-lg font-semibold text-white truncate">
                                      {p.name}
                                    </h2>
                                )}

                                <p className="text-[11px] text-gray-300/60">
                                  ID: {p.id} · Model: {p.model || "—"} · Serial:{" "}
                                  {p.serialNumber || "—"}
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
                                          className={
                                              fieldBase +
                                              " w-28 text-right disabled:opacity-50 disabled:cursor-not-allowed"
                                          }
                                          disabled={isProductManager}
                                          title={
                                            isProductManager
                                                ? "Only Sales Managers can edit price"
                                                : ""
                                          }
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
                              {isEditing && (
                                  <div className="mt-2">
                                    <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60 mb-1">
                                      Category
                                    </p>
                                    <select
                                        value={editCategory}
                                        onChange={(e) => setEditCategory(e.target.value)}
                                        className={fieldBase + " w-full md:w-1/2"}
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