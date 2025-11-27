"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

export default function CartPage() {
  const { user, loadingUser } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Load cart
  useEffect(() => {
    async function loadCart() {
      setLoadingCart(true);
      setMessage("");

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

        if (!token) {
          setItems([]);
          setLoadingCart(false);
          return;
        }

        const res = await fetch(`${apiBase}/cart`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setItems([]);
          setLoadingCart(false);
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          setItems([]);
          setLoadingCart(false);
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          setItems([]);
          setLoadingCart(false);
          return;
        }

        // Expect array; if not, fall back to empty
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Cart load error:", err);
        setItems([]);
      } finally {
        setLoadingCart(false);
      }
    }

    if (!loadingUser) {
      loadCart();
    }
  }, [apiBase, loadingUser]);

  // Compute subtotal
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const unitPrice =
        item.unitPrice ??
        item.price ??
        item.product?.price ??
        0;
      return sum + Number(unitPrice || 0) * (item.quantity || 0);
    }, 0);
  }, [items]);

  // Helper: fire cart-updated
  function notifyCartUpdated() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cart-updated"));
    }
  }

  async function handleUpdateQuantity(productId, newQty) {
    if (newQty < 1) {
      return handleRemoveItem(productId);
    }

    setMessage("");

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      router.push("/login?next=/cart");
      return;
    }

    try {
      const res = await fetch(`${apiBase}/cart/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          quantity: newQty,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        setMessage(
          (data && data.message) || "Failed to update quantity."
        );
        return;
      }

      // Update local state
      setItems((prev) =>
        prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity: newQty }
            : item
        )
      );
      notifyCartUpdated();
    } catch (err) {
      console.error("Update quantity error:", err);
      setMessage("Failed to update quantity.");
    }
  }

  async function handleRemoveItem(productId) {
    setMessage("");

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      router.push("/login?next=/cart");
      return;
    }

    try {
      const res = await fetch(
        `${apiBase}/cart/remove/${productId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const contentType = res.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        setMessage(
          (data && data.message) || "Failed to remove item."
        );
        return;
      }

      setItems((prev) =>
        prev.filter((item) => item.productId !== productId)
      );
      notifyCartUpdated();
    } catch (err) {
      console.error("Remove item error:", err);
      setMessage("Failed to remove item.");
    }
  }

  async function handlePlaceOrder() {
    setMessage("");

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      router.push("/login?next=/cart");
      return;
    }

    if (items.length === 0) {
      setMessage("Your bag is empty.");
      return;
    }

    setPlacingOrder(true);
    try {
      const res = await fetch(`${apiBase}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const contentType = res.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        setMessage(
          (data && data.message) || "Failed to place order."
        );
        setPlacingOrder(false);
        return;
      }

      setItems([]);
      notifyCartUpdated();
      setMessage("Order placed successfully.");
      // Optional: navigate to orders page
      // router.push("/orders");
    } catch (err) {
      console.error("Place order error:", err);
      setMessage("Failed to place order.");
    } finally {
      setPlacingOrder(false);
    }
  }

  // Extract product fields robustly
  function getItemInfo(item) {
    const product = item.product || {};
    const name =
      product.name ||
      item.productName ||
      `Product #${item.productId}`;
    const description =
      product.description || item.productDescription || "";
    const price =
      item.unitPrice ??
      item.price ??
      product.price ??
      0;
    const imageUrl =
      product.imageUrl ||
      item.productImageUrl ||
      null;

    const imageSrc = imageUrl
      ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${imageUrl}`
      : null;

    return { name, description, price, imageSrc };
  }

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">
          Checking your session…
        </p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            Your bag
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in to view your bag.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/cart"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium uppercase tracking-[0.18em] text-gray-800 hover:bg-gray-100 transition-colors"
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
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              SNEAKS-UP
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
              Your bag
            </h1>
          </div>
          <Link
            href="/products"
            className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black"
          >
            Continue shopping
          </Link>
        </header>

        {/* Main content layout */}
        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
          {/* Left: items list */}
          <div className="space-y-3">
            {loadingCart ? (
              <p className="text-sm text-gray-500">
                Loading your bag…
              </p>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center space-y-2">
                <p className="text-sm font-medium text-gray-800">
                  Your bag is empty.
                </p>
                <p className="text-xs text-gray-500">
                  Add something from the drops page to see it here.
                </p>
                <Link
                  href="/products"
                  className="inline-flex mt-2 px-4 py-2 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
                >
                  Browse drops
                </Link>
              </div>
            ) : (
              items.map((item) => {
                const { name, description, price, imageSrc } =
                  getItemInfo(item);
                const lineTotal = Number(price || 0) * item.quantity;

                return (
                  <div
                    key={`${item.id ?? item.productId}`}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-3 sm:px-5 sm:py-4 flex gap-3 sm:gap-4 items-center"
                  >
                    {/* Image */}
                    <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] tracking-[0.2em] text-gray-500 uppercase">
                          Sneaks
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {name}
                      </p>
                      {description && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <p className="text-xs font-medium text-gray-900">
                          ${Number(price || 0).toFixed(2)}
                        </p>

                        {/* Quantity controls */}
                        <div className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-2 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQuantity(
                                item.productId,
                                (item.quantity || 1) - 1
                              )
                            }
                            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 text-xs text-gray-800 hover:bg-gray-100"
                          >
                            –
                          </button>
                          <span className="w-7 text-center text-xs font-medium text-gray-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQuantity(
                                item.productId,
                                (item.quantity || 1) + 1
                              )
                            }
                            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 text-xs text-gray-800 hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveItem(item.productId)
                          }
                          className="text-[11px] text-gray-500 hover:text-red-500 underline underline-offset-4"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="hidden sm:flex flex-col items-end text-xs font-semibold text-gray-900">
                      <span>${lineTotal.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: summary */}
          <aside className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                Summary
              </p>
              <p className="text-[11px] text-gray-500">
                Review your items before placing your order.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-700">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-500 text-xs">
                <span>Shipping</span>
                <span>Calculated later</span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                <span>Total</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={
                  placingOrder || items.length === 0 || subtotal <= 0
                }
                className="w-full mt-1 rounded-full bg-black text-white text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] py-2.5 hover:bg-gray-900 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
              >
                {placingOrder ? "Placing order…" : "Place order"}
              </button>

              {message && (
                <p className="text-[11px] text-gray-700 pt-1">
                  {message}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
