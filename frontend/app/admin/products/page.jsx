"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import { useAuth } from "../../../context/AuthContext";

export default function AdminProductsPage() {
  const { user, loadingUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    isActive: true,
  });

  function resetForm() {
    setForm({
      name: "",
      description: "",
      price: "",
      stock: "",
      isActive: true,
    });
    setEditingId(null);
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function loadProducts() {
    setLoadingProducts(true);
    setMessage("");

    try {
      const res = await fetch(`${apiBase}/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Admin load products error:", err);
      setMessage("Failed to load products.");
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    if (!loadingUser && user && user.roleId === 1) {
      loadProducts();
    } else if (!loadingUser) {
      setLoadingProducts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("Please login as admin.");
        return;
      }

      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        stock: Number(form.stock),
        isActive: form.isActive,
      };

      let url = `${apiBase}/products`;
      let method = "POST";

      if (editingId !== null) {
        url = `${apiBase}/products/${editingId}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to save product.");
      } else {
        setMessage(
          editingId
            ? "Product updated successfully."
            : "Product created successfully."
        );
        resetForm();
        await loadProducts();
      }
    } catch (err) {
      console.error("Save product error:", err);
      setMessage("Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price?.toString() ?? "",
      stock: product.stock?.toString() ?? "",
      isActive: product.isActive ?? true,
    });
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this product?")) return;

    try {
      setSaving(true);
      setMessage("");
      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("Please login as admin.");
        return;
      }

      const res = await fetch(`${apiBase}/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.message || "Failed to delete product.");
      } else {
        setMessage("Product deleted.");
        await loadProducts();
      }
    } catch (err) {
      console.error("Delete product error:", err);
      setMessage("Failed to delete product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(productId, file) {
    if (!file) return;

    try {
      setSaving(true);
      setMessage("");
      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("Please login as admin.");
        return;
      }

      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`${apiBase}/products/${productId}/image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.message || "Failed to upload image.");
      } else {
        setMessage("Image uploaded.");
        await loadProducts();
      }
    } catch (err) {
      console.error("Upload product image error:", err);
      setMessage("Failed to upload image.");
    } finally {
      setSaving(false);
    }
  }

  // auth loading
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking admin access…</p>
      </SiteLayout>
    );
  }

  // not logged in
  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Admin · Products
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in as an admin to view this page.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // logged in but not admin
  if (user.roleId !== 1) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Admin · Products
          </h1>
          <p className="text-sm text-gray-600">
            Your account does not have admin permissions.
          </p>
        </div>
      </SiteLayout>
    );
  }

  // admin view
  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap itemsCENTER justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Admin · Products
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Create, update, and delete products.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-[11px] text-gray-700 underline underline-offset-4"
          >
            Back to admin dashboard
          </Link>
        </div>

        {message && (
          <p className="text-xs text-gray-700">{message}</p>
        )}

        {/* Create / Edit form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {editingId ? "Edit product" : "Create new product"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-gray-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Price</label>
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-gray-300"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Stock</label>
                <input
                  name="stock"
                  type="number"
                  value={form.stock}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-gray-300"
                />
              </div>
              <div className="flex items-center gap-2 mt-5">
                <input
                  id="isActive"
                  name="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={handleFormChange}
                  className="h-4 w-4 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="text-xs text-gray-700">
                  Active (visible in store)
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-600">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleFormChange}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-gray-300"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 disabled:opacity-60 transition-colors"
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Save changes"
                  : "Create product"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Products list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Existing products
          </h2>
          {loadingProducts ? (
            <p className="text-sm text-gray-500">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-gray-500">
              No products yet. Use the form above to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {products.map((p) => {
                const imageSrc = p.imageUrl
                  ? `${apiBase}${p.imageUrl}`
                  : null;

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex gap-3 items-start">
                      <div className="w-20 h-16 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] tracking-wide text-gray-500 uppercase">
                            Img
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">
                          {p.name}{" "}
                          {!p.isActive && (
                            <span className="ml-1 text-[10px] uppercase tracking-wide text-red-500">
                              (inactive)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          ID: {p.id} · ${Number(p.price || 0).toFixed(2)} · Stock:{" "}
                          {p.stock}
                        </p>
                        {p.description && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        <div className="mt-2">
                          <label className="text-[11px] text-gray-600 mr-2">
                            Upload image:
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={saving}
                            onChange={(e) =>
                              handleImageChange(
                                p.id,
                                e.target.files?.[0] || null
                              )
                            }
                            className="text-[11px]"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="px-3 py-1.5 rounded-full border border-gray-300 text-[11px] font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={saving}
                        className="px-3 py-1.5 rounded-full border border-red-300 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                      >
                        Delete
                      </button>
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
