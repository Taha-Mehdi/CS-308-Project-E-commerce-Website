"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";
// Note: MockPaymentModal import removed since we are doing it inline now.
import {
  getCartApi,
  getProductsApi,
  updateCartItemApi,
  removeFromCartApi,
  createOrderApi,
} from "../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function CartPage() {
  const { user, loadingUser, logout } = useAuth();
  const router = useRouter();

  // --- CART STATES ---
  const [cartItems, setCartItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  // --- PAYMENT FORM STATES (New) ---
  const [showPaymentForm, setShowPaymentForm] = useState(false); // Controls the dropdown
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [paymentError, setPaymentError] = useState("");

  // --- LOAD DATA ---
  useEffect(() => {
    async function loadCartAndProducts() {
      setLoading(true);
      setMessage("");

      try {
        let productsData = [];
        try {
          productsData = await getProductsApi();
        } catch (err) {
          console.warn("Could not load products API, using cart data only");
        }
        setProducts(Array.isArray(productsData) ? productsData : []);

        if (user) {
          const cartData = await getCartApi();
          setCartItems(Array.isArray(cartData) ? cartData : []);
        } else {
          const localCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
          setCartItems(localCart);
        }

      } catch (err) {
        console.error("Cart page load error:", err);
        if (err.status === 401 && user) {
          logout();
          router.push("/login");
        } else {
          setMessage("Failed to load bag.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser) {
      loadCartAndProducts();
    }
  }, [loadingUser, user, logout, router]);

  const productsMap = useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const enrichedItems = useMemo(() => {
    return cartItems.map((item) => {
      let product = productsMap.get(item.productId);
      if (!product) {
        product = {
          id: item.productId,
          name: item.name || "Unknown Item",
          price: item.price || 0,
          imageUrl: item.imageUrl,
          description: item.description
        };
      }
      return { ...item, product };
    });
  }, [cartItems, productsMap]);

  const cartTotal = useMemo(() => {
    return enrichedItems.reduce((sum, ci) => {
      const price = ci.product ? Number(ci.product.price || 0) : 0;
      return sum + price * (ci.quantity || 0);
    }, 0);
  }, [enrichedItems]);

  // --- CART ACTIONS ---
  async function handleUpdateQuantity(productId, newQty) {
    if (newQty <= 0) return handleRemove(productId);
    if (!user) {
      const localCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
      const updated = localCart.map(item =>
          item.productId === productId ? { ...item, quantity: newQty } : item
      );
      localStorage.setItem("guestCart", JSON.stringify(updated));
      setCartItems(updated);
      return;
    }
    try {
      setMessage("");
      await updateCartItemApi(productId, newQty);
      setCartItems((prev) =>
          prev.map((ci) => ci.productId === productId ? { ...ci, quantity: newQty } : ci)
      );
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleRemove(productId) {
    if (!user) {
      const localCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
      const filtered = localCart.filter(item => item.productId !== productId);
      localStorage.setItem("guestCart", JSON.stringify(filtered));
      setCartItems(filtered);
      return;
    }
    try {
      setMessage("");
      await removeFromCartApi(productId);
      setCartItems((prev) => prev.filter((ci) => ci.productId !== productId));
    } catch (err) {
      handleApiError(err);
    }
  }

  function handleApiError(err) {
    if (err.status === 401) {
      setMessage("Your session has expired. Please log in again.");
      logout();
      router.push("/login");
    } else {
      setMessage(err.message || "Action failed.");
      alert(err.message || "Action failed.");
    }
  }

  // --- PAYMENT INPUT HANDLERS (Inline Logic) ---

  const handleNameChange = (e) => {
    const val = e.target.value;
    // Regex: Letters and spaces only
    if (/^[a-zA-Z\s]*$/.test(val)) {
      setCardName(val);
    }
  };

  const handleCardNumberChange = (e) => {
    const val = e.target.value;
    // Regex: Integers only
    if (/^\d*$/.test(val)) {
      setCardNumber(val);
    }
  };

  // --- CHECKOUT & ORDER LOGIC ---

  // 1. Opens the inline form
  function handleCheckoutClick() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (enrichedItems.length === 0) {
      setMessage("Your bag is empty.");
      return;
    }
    setShowPaymentForm(true); // Dropdown opens
  }

  // 2. Finalizes the order (triggered by "Pay Now")
  async function finalizeOrder() {
    // Validation
    if (!cardName || cardNumber.length < 12) {
      setPaymentError("Please enter a valid Name and Card Number.");
      return;
    }
    setPaymentError(""); // Clear error
    setPlacingOrder(true);
    setMessage("");

    try {
      const itemsPayload = enrichedItems.map((ci) => ({
        productId: ci.productId,
        quantity: ci.quantity,
      }));

      // Call Backend API
      const data = await createOrderApi(itemsPayload);
      const orderId = data?.orderId || null;
      setLastOrderId(orderId);

      // Clear Cart and Form
      setCartItems([]);
      setCardName("");
      setCardNumber("");

      // Show Invoice Screen
      setShowInvoice(true);

    } catch (err) {
      handleApiError(err);
    } finally {
      setPlacingOrder(false);
    }
  }

  // --- RENDER ---

  if (loading) {
    return (
        <SiteLayout>
          <div className="space-y-5"><p>Loading bag...</p></div>
        </SiteLayout>
    );
  }

  // SUCCESS / INVOICE SCREEN
  if (showInvoice) {
    return (
        <SiteLayout>
          <div className="max-w-2xl mx-auto mt-10 p-8 border border-green-200 rounded-3xl bg-green-50 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">✅</span>
            </div>
            <h2 className="text-3xl font-bold text-green-800 mb-2">Order Confirmed!</h2>
            <p className="text-green-700 mb-6">
              Thank you for your purchase. Your payment was successful.
            </p>

            <div className="bg-white p-6 rounded-2xl shadow-sm text-left mb-8">
              <h3 className="text-lg font-bold border-b pb-2 mb-4">Invoice Details</h3>
              <p className="text-sm text-gray-600">Order ID: <span className="font-mono text-black">#{lastOrderId || "12345"}</span></p>
              <p className="text-sm text-gray-600">Status: <span className="font-bold text-green-600">Paid & Processing</span></p>
              <p className="text-sm text-gray-600 mt-2">A copy of this invoice has been sent to your email.</p>
            </div>

            <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900"
            >
              Continue Shopping
            </button>
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
              <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">Sneaks-up</p>
              <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">Your Cart</h1>
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
                <p className="text-sm text-gray-600">Your cart is empty.</p>
                <Link
                    href="/products"
                    className="inline-flex px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900"
                >
                  Browse drops
                </Link>
              </div>
          ) : (
              <div className="flex flex-col md:flex-row gap-8">
                {/* --- LEFT SIDE: CART ITEMS --- */}
                <div className="w-full md:w-2/3 space-y-3">
                  {enrichedItems.map((ci) => {
                    const p = ci.product;
                    const price = p ? Number(p.price || 0) : 0;
                    const imageUrl = p?.imageUrl ? (p.imageUrl.startsWith("http") ? p.imageUrl : `${apiBase}${p.imageUrl}`) : null;

                    return (
                        <div key={ci.productId} className="group rounded-3xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center">
                          <div className="w-full sm:w-32">
                            <div className="w-full aspect-square rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center">
                              {imageUrl ? (
                                  <img src={imageUrl} alt={p?.name} className="w-full h-full object-cover" />
                              ) : (
                                  <span className="text-[9px] uppercase tracking-[0.22em] text-gray-400">No Image</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{p?.name}</p>
                                <p className="text-[11px] text-gray-500">${price.toFixed(2)}</p>
                              </div>
                              <button type="button" onClick={() => handleRemove(ci.productId)} className="text-[10px] text-gray-500 hover:text-black underline">
                                Remove
                              </button>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                              <button onClick={() => handleUpdateQuantity(ci.productId, ci.quantity - 1)} className="w-6 h-6 bg-gray-100 rounded-full">-</button>
                              <span className="text-xs font-semibold">{ci.quantity}</span>
                              <button onClick={() => handleUpdateQuantity(ci.productId, ci.quantity + 1)} className="w-6 h-6 bg-gray-100 rounded-full">+</button>
                            </div>
                          </div>
                        </div>
                    );
                  })}
                </div>

                {/* --- RIGHT SIDE: SUMMARY & CHECKOUT --- */}
                <div className="w-full md:w-1/3 h-fit">
                  <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 text-gray-900">Order Summary</h3>
                    <div className="flex justify-between mb-2 text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-6 font-bold text-lg text-gray-900 border-t pt-2">
                      <span>Total</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>

                    {/* --- DROPDOWN PAYMENT FORM --- */}
                    {showPaymentForm ? (
                        <div className="animate-fade-in space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                          <h4 className="font-bold text-sm text-gray-800">🏦 Payment Details</h4>

                          {/* Name Input */}
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Card Holder Name</label>
                            <input
                                type="text"
                                value={cardName}
                                onChange={handleNameChange}
                                placeholder="e.g. John Doe"
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Letters only</p>
                          </div>

                          {/* Card Input */}
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Card Number</label>
                            <input
                                type="text"
                                value={cardNumber}
                                onChange={handleCardNumberChange}
                                placeholder="0000 0000 0000 0000"
                                maxLength={16}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Integers only</p>
                          </div>

                          {/* Error Message */}
                          {paymentError && (
                              <p className="text-red-600 text-xs font-medium bg-red-50 p-2 rounded">
                                {paymentError}
                              </p>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-col gap-2 pt-2">
                            <button
                                onClick={finalizeOrder}
                                disabled={placingOrder}
                                className="w-full py-2.5 rounded-full bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors disabled:bg-gray-400"
                            >
                              {placingOrder ? "Processing..." : "Pay Now"}
                            </button>
                            <button
                                onClick={() => setShowPaymentForm(false)}
                                className="w-full py-2.5 rounded-full bg-white border border-gray-300 text-gray-700 text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                    ) : (
                        /* --- DEFAULT BUTTON --- */
                        <button
                            type="button"
                            onClick={handleCheckoutClick}
                            disabled={placingOrder}
                            className="w-full py-3 rounded-full bg-black text-white text-xs font-bold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all active:scale-[0.97] disabled:bg-gray-400 shadow-lg shadow-gray-200"
                        >
                          {user ? "Proceed to Checkout" : "Log in to Checkout"}
                        </button>
                    )}
                  </div>
                </div>
              </div>
          )}
        </div>
      </SiteLayout>
  );
}