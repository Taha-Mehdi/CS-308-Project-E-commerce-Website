"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import { useAuth } from "../../../context/AuthContext";

export default function AdminProductsPage() {
  const { user, loadingUser } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [formMessage, setFormMessage] = useState("");
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Load products
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/products`);
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Load products error:", err);
      } finally {
        setLoading(false);
      }
    }
    if (!loadingUser && user && user.roleId === 1) loadProducts();
  }, [apiBase, loadingUser, user]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setPrice("");
    setStock("");
    setDescription("");
    setIsActive(true);
    setShowForm(false);
    setFormMessage("");
  }

  // Submit (create or edit)
  async function handleSubmitProduct(e) {
    e.preventDefault();
    setLoadingSubmit(true);
    setFormMessage("");

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      setFormMessage("Missing token.");
      setLoadingSubmit(false);
      return;
    }

    const payload = {
      name,
      price: price ? Number(price) : 0,
      stock: stock ? Number(stock) : 0,
      description,
      isActive,
    };

    try {
      const url = editingId
        ? `${apiBase}/products/${editingId}`
        : `${apiBase}/products`;

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      let data = null;
      if (ct.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        setFormMessage(
          (data && data.message) || "Failed to save product."
        );
        setLoadingSubmit(false);
        return;
      }

      // reload products
      const res2 = await fetch(`${apiBase}/products`);
      const data2 = await res2.json();
      setProducts(Array.isArray(data2) ? data2 : []);

      resetForm();
    } catch (err) {
      console.error("Submit product error:", err);
      setFormMessage("Failed to save product.");
    } finally {
      setLoadingSubmit(false);
    }
  }

  function startEdit(product) {
    setEditingId(product.id);
    setName(product.name || "");
    setPrice(product.price || "");
    setStock(product.stock || "");
    setDescription(product.description || "");
    setIsActive(product.isActive ?? true);
    setShowForm(true);
  }

  async function handleDeleteProduct(id) {
    if (!confirm("Delete this product?")) return;

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      alert("Missing token.");
      return;
    }

    try {
      const res = await fetch(`${apiBase}/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert("Failed to delete.");
        return;
      }

      // reload list
      const res2 = await fetch(`${apiBase}/products`);
      const data2 = await res2.json();
      setProducts(Array.isArray(data2) ? data2 : []);
    } catch (err) {
      console.error("Delete product error:", err);
      alert("Failed to delete.");
    }
  }

  async function handleUploadImage(id, file) {
    if (!file) return;

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      alert("Missing token.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(`${apiBase}/products/${id}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const ct = res.headers.get("content-type") || "";
      let data = null;
      if (ct.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        alert((data && data.message) || "Image upload failed.");
        return;
      }

      // reload
      const res2 = await fetch(`${apiBase}/products`);
      const data2 = await res2.json();
      setProducts(Array.isArray(data2) ? data2 : []);
    } catch (err) {
      console.error("Upload image error:", err);
      alert("Image upload failed.");
    }
  }

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">
          Checking your admin access…
        </p>
      </SiteLayout>
    );
  }

  if (!user || user.roleId !== 1) {
    return (
      <SiteLayout>
        <h1 className="text-xl sm:text-2xl font-semibold">
          Admin · Products
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          You do not have admin access.
        </p>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              SNEAKS-UP · Admin
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
              Manage drops
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Add new sneaker releases or update existing drops.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
          >
            + Add drop
          </button>
        </header>

        {/* CREATE / EDIT FORM */}
        {showForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">
              {editingId ? "Edit drop" : "Add new drop"}
            </h2>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-gray-600">Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-600">Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-600">Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-600">Active?</label>
                  <select
                    value={isActive}
                    onChange={(e) =>
                      setIsActive(e.target.value === "true")
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-600">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {formMessage && (
                <p className="text-xs text-red-500">{formMessage}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loadingSubmit}
                  className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 disabled:opacity-70 transition"
                >
                  {loadingSubmit
                    ? "Saving…"
                    : editingId
                    ? "Save changes"
                    : "Add drop"}
                </button>

                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium uppercase tracking-[0.18em] text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PRODUCTS TABLE */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">
            All drops
          </h2>

          {loading ? (
            <p className="text-sm text-gray-500">Loading drops…</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-gray-500">No products found.</p>
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row gap-4"
                >
                  {/* Image */}
                  <div className="w-full sm:w-36 h-36 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                    {p.imageUrl ? (
                      <img
                        src={`${apiBase}${p.imageUrl}`}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] tracking-[0.2em] text-gray-500 uppercase">
                        Sneaks
                      </span>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {p.name}
                    </p>

                    <p className="text-xs text-gray-500 line-clamp-2">
                      {p.description || "No description"}
                    </p>

                    <p className="text-xs text-gray-700 pt-1">
                      <span className="font-medium">
                        ${Number(p.price).toFixed(2)}
                      </span>{" "}
                      · Stock: {p.stock}
                    </p>

                    <span
                      className={`inline-flex mt-1 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                        p.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 sm:w-48">
                    {/* Upload image */}
                    <label className="cursor-pointer px-3 py-1.5 rounded-full border border-gray-300 text-[11px] font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                      Upload image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleUploadImage(p.id, e.target.files[0])
                        }
                      />
                    </label>

                    <button
                      onClick={() => startEdit(p)}
                      className="px-3 py-1.5 rounded-full bg-black text-white text-[11px] font-medium uppercase tracking-[0.16em] hover:bg-gray-900 transition-colors"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="px-3 py-1.5 rounded-full border border-gray-300 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}
