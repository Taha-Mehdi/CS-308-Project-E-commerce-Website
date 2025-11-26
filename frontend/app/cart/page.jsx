"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

export default function CartPage() {
  const { user, loadingUser } = useAuth();

  const [cartItems, setCartItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  async function loadCartAndProducts() {
    setLoadingCart(true);
    setMessage("");

    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      if (!token) {
        setCartItems([]);
        setProducts([]);
        setLoadingCart(false);
        return;
      }

      // Fetch cart items
      const cartRes = await fetch(`${apiBase}/cart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const cartData = await cartRes.json();

      // Fetch products
      const prodRes = await fetch(`${apiBase}/products`);
      const prodData = await prodRes.json();

      setCartItems(Array.isArray(cartData) ? cartData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
    } catch (err) {
      console.error("Failed to load cart/products:", err);
      setCartItems([]);
      setProducts([]);
    } finally {
      setLoadingCart(false);
    }
  }

  useEffect(() => {
    if (!loadingUser) {
      loadCartAndProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser]);

  const productsMap = useMemo(() => {
    const m = new Map();
    for (const p of products) {
      m.set(p.id, p);
    }
    return m;
  }, [products]);

  const enrichedCart = useMemo(
    () =>
      cartItems.map((item) => ({
        ...item,
        product: productsMap.get(item.productId) || null,
      })),
    [cartItems, productsMap]
  );

  const total = useMemo(() => {
    let sum = 0;
    for (const item of enrichedCart) {
      if (!item.product) continue;
      const priceNumber = Number(item.product.price || 0);
      sum += priceNumber * item.quantity;
    }
    return sum;
  }, [enrichedCart]);

  async function handleQuantityChange(productId, newQuantity) {
    const qty = Number(newQuantity);
    if (!Number.isFinite(qty) || qty < 1) return;

    try {
      setLoadingAction(true);
      setMessage("");
      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("Please login to update your cart.");
        return;
      }

      const res = await fetch(`${apiBase}/cart/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, quantity: qty }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.message || "Failed to update cart item.");
      } else {
        await loadCartAndProducts();

        // notify navbar to refresh cart badge
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cart-updated"));
        }
      }
    } catch (err) {
      console.error("Update cart error:", err);
      setMessage("Failed to update cart item.");
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleRemove(productId) {
    try {
      setLoadingAction(true);
      setMessage("");
      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("Please login to update your cart.");
        return;
      }

      const res = await fetch(`${apiBase}/cart/remove/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.message || "Failed to remove item.");
      } else {
        await loadCartAndProducts();

        // notify navbar to refresh cart badge
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cart-updated"));
        }
      }
    } catch (err) {
      console.error("Remove cart item error:", err);
      setMessage("Failed to remove item.");
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleCheckout() {
    if (enrichedCart.length === 0) {
      setMessage("Your cart is empty.");
      return;
    }

    try {
      setLoadingAction(true);
      setMessage("");

      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("Please login to checkout.");
        return;
      }

      const items = enrichedCart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      const res = await fetch(`${apiBase}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to create order.");
      } else {
        setMessage(
          `Order created successfully. Order ID: ${data.orderId}, Total: $${data.total}`
        );

        // Attempt to clear cart items in backend
        for (const item of enrichedCart) {
          try {
            await fetch(`${apiBase}/cart/remove/${item.productId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch {
            // ignore per-item delete error
          }
        }

        await loadCartAndProducts();

        // notify navbar to refresh cart badge
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cart-updated"));
        }
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setMessage("Failed to create order.");
    } finally {
      setLoadingAction(false);
    }
  }

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking login status…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Your Cart
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in to view your cart.
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

  return (
    <SiteLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Your Cart
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Review your items before placing an order.
          </p>
        </div>

        {loadingCart ? (
          <p className="text-sm text-gray-500">Loading cart…</p>
        ) : enrichedCart.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Your cart is empty.
            </p>
            <Link
              href="/products"
              className="inline-flex text-xs text-gray-800 underline underline-offset-4"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            {/* Cart items */}
            <div className="space-y-3">
              {enrichedCart.map((item) => {
                const p = item.product;
                const priceNumber = p ? Number(p.price || 0) : 0;
                const lineTotal = priceNumber * item.quantity;

                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex gap-4">
                      <div className="w-20 h-16 rounded-xl bg-gray-100 flex items-center justify-center">
                        <span className="text-[10px] tracking-wide text-gray-500 uppercase">
                          Img
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">
                          {p ? p.name : `Product #${item.productId}`}
                        </p>
                        {p?.description && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          ${priceNumber.toFixed(2)} each
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleQuantityChange(
                              item.productId,
                              item.quantity - 1
                            )
                          }
                          disabled={item.quantity <= 1 || loadingAction}
                          className="w-6 h-6 rounded-full border border-gray-300 text-xs flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(
                              item.productId,
                              e.target.value
                            )
                          }
                          className="w-12 border border-gray-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring focus:ring-gray-300"
                        />
                        <button
                          onClick={() =>
                            handleQuantityChange(
                              item.productId,
                              item.quantity + 1
                            )
                          }
                          disabled={loadingAction}
                          className="w-6 h-6 rounded-full border border-gray-300 text-xs flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>

                      <p className="text-xs font-semibold text-gray-900">
                        ${lineTotal.toFixed(2)}
                      </p>

                      <button
                        onClick={() => handleRemove(item.productId)}
                        disabled={loadingAction}
                        className="text-[11px] text-gray-500 hover:text-red-600 underline underline-offset-4 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold tracking-[0.2em] text-gray-600 uppercase">
                Summary
              </h2>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">
                  ${total.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Taxes and shipping are not calculated in this demo. This is a
                course project checkout flow.
              </p>
              <button
                onClick={handleCheckout}
                disabled={loadingAction || enrichedCart.length === 0}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loadingAction ? "Processing…" : "Place order"}
              </button>
              {message && (
                <p className="text-[11px] text-gray-700">{message}</p>
              )}
              <Link
                href="/products"
                className="inline-flex text-[11px] text-gray-700 underline underline-offset-4 mt-2"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
