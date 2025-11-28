"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function CartPage() {
  const { user, loadingUser } = useAuth();

  const [cartItems, setCartItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [lastOrderTotal, setLastOrderTotal] = useState(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

  // Load cart + products
  useEffect(() => {
    async function loadCartAndProducts() {
      setLoading(true);
      setMessage("");

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

        if (!token) {
          setCartItems([]);
          setProducts([]);
          setLoading(false);
          return;
        }

        // 1) Cart items
        const cartRes = await fetch(`${apiBase}/cart`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!cartRes.ok) {
          let msg = "Failed to load your bag.";
          const ct = cartRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const errJson = await cartRes.json();
              if (errJson && errJson.message) msg = errJson.message;
            } catch {
              // ignore
            }
          }
          setMessage(msg);
          setCartItems([]);
        } else {
          const ct = cartRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const ci = await cartRes.json();
              setCartItems(Array.isArray(ci) ? ci : []);
            } catch {
              setCartItems([]);
              setMessage("Could not decode cart items.");
            }
          } else {
            setCartItems([]);
            setMessage("Unexpected response when loading bag.");
          }
        }

        // 2) Products (for names, prices, images)
        const prodRes = await fetch(`${apiBase}/products`);
        if (prodRes.ok) {
          const ct = prodRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const data = await prodRes.json();
              setProducts(Array.isArray(data) ? data : []);
            } catch {
              setProducts([]);
            }
          } else {
            setProducts([]);
          }
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error("Cart page load error:", err);
        setCartItems([]);
        setProducts([]);
        setMessage("Failed to load bag.");
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser && user) {
      loadCartAndProducts();
    } else if (!loadingUser) {
      setLoading(false);
    }
  }, [apiBase, loadingUser, user]);

  const productsMap = useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  // Enriched cart items with product info
  const enrichedItems = useMemo(() => {
    return cartItems.map((item) => {
      const product = productsMap.get(item.productId);
      return { ...item, product };
    });
  }, [cartItems, productsMap]);

  const cartTotal = useMemo(() => {
    return enrichedItems.reduce((sum, ci) => {
      const price = ci.product ? Number(ci.product.price || 0) : 0;
      return sum + price * (ci.quantity || 0);
    }, 0);
  }, [enrichedItems]);

  async function handleUpdateQuantity(productId, newQty) {
    if (newQty <= 0) {
      return handleRemove(productId);
    }

    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;

      if (!token) {
        setMessage("Please login again to update your bag.");
        return;
      }

      const res = await fetch(`${apiBase}/cart/update`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          quantity: newQty,
        }),
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
        console.error("Update cart failed:", data || {});
        const msg =
          (data && data.message) || "Could not update this item.";
        setMessage(msg);
        if (typeof window !== "undefined") {
          window.alert(msg);
        }
        return;
      }

      // Update local state
      setCartItems((prev) =>
        prev.map((ci) =>
          ci.productId === productId
            ? { ...ci, quantity: newQty }
            : ci
        )
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }
    } catch (err) {
      console.error("Update cart error:", err);
      const msg = "Could not update this item.";
      setMessage(msg);
      if (typeof window !== "undefined") {
        window.alert(msg);
      }
    }
  }

  async function handleRemove(productId) {
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;

      if (!token) {
        setMessage("Please login again to update your bag.");
        return;
      }

      const res = await fetch(
        `${apiBase}/cart/remove/${productId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

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
        console.error("Remove cart item failed:", data || {});
        const msg =
          (data && data.message) || "Could not remove this item.";
        setMessage(msg);
        if (typeof window !== "undefined") {
          window.alert(msg);
        }
        return;
      }

      setCartItems((prev) =>
        prev.filter((ci) => ci.productId !== productId)
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }
    } catch (err) {
      console.error("Remove cart item error:", err);
      const msg = "Could not remove this item.";
      setMessage(msg);
      if (typeof window !== "undefined") {
        window.alert(msg);
      }
    }
  }

  async function handleCheckout() {
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;

      if (!token) {
        setMessage("Please login again to place an order.");
        if (typeof window !== "undefined") {
          window.alert("Please login again to place an order.");
        }
        return;
      }

      if (enrichedItems.length === 0) {
        setMessage("Your bag is empty.");
        return;
      }

      setPlacingOrder(true);
      setMessage("");

      const itemsPayload = enrichedItems.map((ci) => ({
        productId: ci.productId,
        quantity: ci.quantity,
      }));

      const res = await fetch(`${apiBase}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: itemsPayload }),
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
        console.error("Place order failed:", data || {});
        const msg =
          (data && data.message) ||
          "Could not place this order. Please try again.";
        setMessage(msg);
        if (typeof window !== "undefined") {
          window.alert(msg);
        }
        return;
      }

      const orderId = data?.orderId || null;
      const total = data?.total || null;

      setLastOrderId(orderId);
      setLastOrderTotal(total);
      setCartItems([]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }

      setMessage("Order placed successfully.");
    } catch (err) {
      console.error("Place order error:", err);
      const msg = "Could not place this order. Please try again.";
      setMessage(msg);
      if (typeof window !== "undefined") {
        window.alert(msg);
      }
    } finally {
      setPlacingOrder(false);
    }
  }

  async function handleDownloadInvoice() {
    if (!lastOrderId) return;

    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;

      if (!token) {
        setMessage("Please login again to download invoices.");
        if (typeof window !== "undefined") {
          window.alert("Please login again to download invoices.");
        }
        return;
      }

      setInvoiceLoadingId(lastOrderId);
      setMessage("");

      const res = await fetch(
        `${apiBase}/invoice/${lastOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const ct = res.headers.get("content-type") || "";

      if (!res.ok) {
        let msg = "Invoice download failed.";
        if (ct.includes("application/json")) {
          try {
            const errJson = await res.json();
            if (errJson && errJson.message) msg = errJson.message;
          } catch {
            // ignore
          }
        }
        console.error("Invoice download failed:", res.status);
        setMessage(msg);
        if (typeof window !== "undefined") {
          window.alert(msg);
        }
        return;
      }

      if (!ct.includes("application/pdf")) {
        const msg = "Unexpected response when downloading invoice.";
        setMessage(msg);
        if (typeof window !== "undefined") {
          window.alert(msg);
        }
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice_${lastOrderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice download error:", err);
      const msg = "Invoice download failed. Please try again.";
      setMessage(msg);
      if (typeof window !== "undefined") {
        window.alert(msg);
      }
    } finally {
      setInvoiceLoadingId(null);
    }
  }

  // AUTH gates
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking your account…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              Your bag
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Login to see your saved pairs and check out.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all active:scale-[0.97]"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-semibold uppercase tracking-[0.18em] text-gray-800 hover:bg-gray-100 transition-all active:scale-[0.97]"
            >
              Create account
            </Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // LOADING SKELETON
  if (loading) {
    return (
      <SiteLayout>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-28 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-6 w-32 rounded-full bg-gray-200 animate-pulse" />
          </div>
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-2xl bg-gray-200 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-1/4 rounded bg-gray-200 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SiteLayout>
    );
  }

  // MAIN CART UI
  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              Your bag
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Review your picks before locking in the drop.
            </p>
          </div>
          <Link
            href="/products"
            className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all active:scale-[0.97]"
          >
            Back to drops
          </Link>
        </div>

        {message && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
            {message}
          </div>
        )}

        {enrichedItems.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Your bag is empty. When you add pairs, they’ll show up here.
            </p>
            <Link
              href="/products"
              className="inline-flex px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all active:scale-[0.97]"
            >
              Browse drops
            </Link>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="space-y-3">
              {enrichedItems.map((ci) => {
                const p = ci.product;
                const price = p ? Number(p.price || 0) : 0;
                const lineTotal = price * (ci.quantity || 0);
                const imageUrl = p?.imageUrl
                  ? `${apiBase}${p.imageUrl}`
                  : null;

                return (
                  <div
                    key={ci.id}
                    className="group rounded-3xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center"
                  >
                    {/* Image */}
                    <div className="w-full sm:w-32">
                      <div className="w-full aspect-square rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={p?.name || "Sneaks-up drop"}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="text-[9px] uppercase tracking-[0.22em] text-gray-400">
                            Sneaks-up drop
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info & controls */}
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-gray-900">
                            {p ? p.name : `Product #${ci.productId}`}
                          </p>
                          {p?.description && (
                            <p className="text-[11px] text-gray-500 line-clamp-2">
                              {p.description}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-500">
                            ${price.toFixed(2)} each
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(ci.productId)}
                          className="text-[10px] text-gray-500 hover:text-black underline underline-offset-4"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        {/* Quantity */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-500">
                            Qty
                          </span>
                          <div className="flex items-center rounded-full border border-gray-300 bg-gray-50 px-1.5 py-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(
                                  ci.productId,
                                  (ci.quantity || 1) - 1
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center text-xs text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={ci.quantity}
                              onChange={(e) =>
                                handleUpdateQuantity(
                                  ci.productId,
                                  Number(e.target.value) || 1
                                )
                              }
                              className="w-10 bg-transparent text-center text-xs text-gray-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(
                                  ci.productId,
                                  (ci.quantity || 1) + 1
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center text-xs text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Line total */}
                        <div className="text-sm font-semibold text-gray-900">
                          ${lineTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary & checkout */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs text-gray-500">
                  Estimated total
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  ${cartTotal.toFixed(2)}
                </p>
                <p className="text-[11px] text-gray-500">
                  Taxes and shipping are calculated at checkout.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={placingOrder || enrichedItems.length === 0}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-black text-white text-[11px] font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {placingOrder ? "Placing order…" : "Place order"}
                </button>

                {lastOrderId && (
                  <button
                    type="button"
                    onClick={handleDownloadInvoice}
                    disabled={invoiceLoadingId === lastOrderId}
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-gray-300 bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-900 hover:bg-gray-100 active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {invoiceLoadingId === lastOrderId
                      ? "Preparing invoice…"
                      : "Download invoice"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
