"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";
import {
  getCartApi,
  getProductsApi,
  updateCartItemApi,
  removeFromCartApi,
  createOrderApi,
} from "../../lib/api";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function CartPage() {
  const { user, loadingUser, logout } = useAuth();
  const router = useRouter();

  // --- DATA STATES ---
  const [cartItems, setCartItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [lastOrderId, setLastOrderId] = useState(null);
  const [finalTotal, setFinalTotal] = useState(0);

  // --- CHECKOUT FLOW STATES ---
  // 1 = Cart View, 2 = Address Input, 3 = Payment Input, 4 = Invoice/Success
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [placingOrder, setPlacingOrder] = useState(false);

  // --- ADDRESS STATE ---
  const [address, setAddress] = useState({
    street: "",
    city: "",
    zip: "",
    country: "Turkey",
  });

  // --- PAYMENT STATE ---
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const isBrowser = typeof window !== "undefined";

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
        } else if (isBrowser) {
          const localCart = JSON.parse(
            window.localStorage.getItem("guestCart") || "[]"
          );
          setCartItems(localCart);
        } else {
          setCartItems([]);
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
  }, [loadingUser, user, logout, router, isBrowser]);

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
          description: item.description,
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

  // --- ACTIONS ---
  async function handleUpdateQuantity(productId, newQty) {
    if (newQty <= 0) return handleRemove(productId);

    // Guest cart
    if (!user) {
      if (!isBrowser) return;

      const localCart = JSON.parse(
        window.localStorage.getItem("guestCart") || "[]"
      );
      const updated = localCart.map((item) =>
        item.productId === productId ? { ...item, quantity: newQty } : item
      );
      window.localStorage.setItem("guestCart", JSON.stringify(updated));
      setCartItems(updated);
      if (isBrowser) window.dispatchEvent(new Event("cart-updated"));
      return;
    }

    // Logged in -> server cart
    try {
      setMessage("");
      await updateCartItemApi(productId, newQty);
      setCartItems((prev) =>
        prev.map((ci) =>
          ci.productId === productId ? { ...ci, quantity: newQty } : ci
        )
      );
      if (isBrowser) window.dispatchEvent(new Event("cart-updated"));
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleRemove(productId) {
    // Guest
    if (!user) {
      if (!isBrowser) return;

      const localCart = JSON.parse(
        window.localStorage.getItem("guestCart") || "[]"
      );
      const filtered = localCart.filter(
        (item) => item.productId !== productId
      );
      window.localStorage.setItem("guestCart", JSON.stringify(filtered));
      setCartItems(filtered);
      if (isBrowser) window.dispatchEvent(new Event("cart-updated"));
      return;
    }

    // Logged in
    try {
      setMessage("");
      await removeFromCartApi(productId);
      setCartItems((prev) =>
        prev.filter((ci) => ci.productId !== productId)
      );
      if (isBrowser) window.dispatchEvent(new Event("cart-updated"));
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
    }
  }

  // --- INPUT HANDLERS ---
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
  };

  const handleNameChange = (e) => {
    if (/^[a-zA-Z\s]*$/.test(e.target.value)) setCardName(e.target.value);
  };

  const handleCardNumberChange = (e) => {
    if (/^\d*$/.test(e.target.value)) setCardNumber(e.target.value);
  };

  // --- FLOW CONTROLLER ---

  // Step 1 -> Step 2
  function handleProceedToAddress() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (enrichedItems.length === 0) {
      setMessage("Your bag is empty.");
      return;
    }
    setCheckoutStep(2);
  }

  // Step 2 -> Step 3
  function handleProceedToPayment() {
    if (!address.street || !address.city || !address.zip) {
      setPaymentError("Please fill in all shipping fields.");
      return;
    }
    setPaymentError("");
    setCheckoutStep(3);
  }

  // Step 3 -> Step 4 (Finalize)
  async function finalizeOrder() {
    if (!cardName || cardNumber.length < 12) {
      setPaymentError("Please enter a valid card holder and number.");
      return;
    }

    setPaymentError("");
    setPlacingOrder(true);
    setMessage("");
    setFinalTotal(cartTotal);

    try {
      const itemsPayload = enrichedItems.map((ci) => ({
        productId: ci.productId,
        quantity: ci.quantity,
      }));

      const data = await createOrderApi(itemsPayload);
      const orderId = data?.orderId || Math.floor(Math.random() * 100000);
      setLastOrderId(orderId);

      setCartItems([]);
      if (isBrowser) {
        window.localStorage.removeItem("guestCart");
        window.dispatchEvent(new Event("cart-updated"));
      }

      setCheckoutStep(4);
    } catch (err) {
      handleApiError(err);
    } finally {
      setPlacingOrder(false);
    }
  }

  // --- UI HELPERS ---

  const stepConfig = [
    { id: 1, label: "Bag" },
    { id: 2, label: "Shipping" },
    { id: 3, label: "Payment" },
    { id: 4, label: "Done" },
  ];

  const isStepComplete = (step) => checkoutStep > step;
  const isStepActive = (step) => checkoutStep === step;

  // --- RENDERING ---

  if (loading || loadingUser) {
    return (
      <SiteLayout>
        <div className="py-16 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-400">
                Sneaks-up
              </p>
              <div className="mt-2 h-6 w-40 rounded-full bg-gray-200 animate-pulse" />
            </div>
            <div className="h-9 w-32 rounded-full bg-gray-200 animate-pulse" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
              >
                <div className="w-full aspect-square rounded-2xl bg-gray-200 animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </SiteLayout>
    );
  }

  // === INVOICE SCREEN (Step 4) ===
  if (checkoutStep === 4) {
    return (
      <SiteLayout>
        <div className="space-y-6 py-8">
          {/* Header + steps */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
                Sneaks-up
              </p>
              <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
                Checkout
              </h1>
            </div>
            <Link
              href="/products"
              className="px-4 py-2.5 rounded-full border border-gray-300 bg-white text-xs font-semibold uppercase tracking-[0.18em] text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Back to drops
            </Link>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
            {stepConfig.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-3">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    checkoutStep >= step.id
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-500 border-gray-300"
                  }`}
                >
                  {step.id}
                </div>
                <span
                  className={
                    checkoutStep >= step.id
                      ? "text-gray-900"
                      : "text-gray-400"
                  }
                >
                  {step.label}
                </span>
                {idx < stepConfig.length - 1 && (
                  <div className="h-px w-6 bg-gray-200" />
                )}
              </div>
            ))}
          </div>

          {/* Success card */}
          <div className="flex justify-center pt-4 pb-12">
            <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white px-6 py-8 sm:px-10 sm:py-10 shadow-lg shadow-black/5 space-y-6">
              <div className="text-center space-y-3 border-b border-gray-100 pb-6">
                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-3xl">✓</span>
                </div>
                <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-emerald-600">
                  Payment confirmed
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
                  Your pair is locked in
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                  We’ve reserved your sneakers and sent a confirmation to your
                  account email. You’ll get tracking details as soon as they
                  ship.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Shipped to
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.fullName || "Valued Customer"}
                  </p>
                  <p className="text-xs text-gray-700">
                    {address.street || "—"}
                  </p>
                  <p className="text-xs text-gray-700">
                    {[address.city, address.zip].filter(Boolean).join(", ")}
                  </p>
                  <p className="text-xs text-gray-700">
                    {address.country || "Turkey"}
                  </p>
                </div>

                <div className="space-y-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Order details
                  </p>
                  <p className="text-xs text-gray-600">
                    Order #
                    <span className="ml-1 font-mono font-semibold text-gray-900">
                      {lastOrderId}
                    </span>
                  </p>
                  <p className="text-xs text-gray-600">
                    Date{" "}
                    <span className="ml-1 font-semibold text-gray-900">
                      {new Date().toLocaleDateString()}
                    </span>
                  </p>
                  <p className="inline-flex items-center justify-end gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Paid
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Total paid
                  </p>
                  <p className="text-xs text-gray-500">
                    Includes all items in your bag at checkout.
                  </p>
                </div>
                <p className="text-2xl sm:text-3xl font-semibold text-gray-900">
                  ${finalTotal.toFixed(2)}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  onClick={() => router.push("/products")}
                  className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white hover:bg-gray-900 transition-all active:scale-[0.97]"
                >
                  Continue shopping
                </button>
                <p className="text-[11px] text-gray-500">
                  You can review this order anytime in{" "}
                  <span className="font-semibold text-gray-800">
                    My Orders
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // === MAIN CART UI (Steps 1–3) ===
  return (
    <SiteLayout>
      <div className="space-y-6 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              Your bag
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Review your picks, lock in shipping, then secure the drop.
            </p>
          </div>
          <Link
            href="/products"
            className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all active:scale-[0.97]"
          >
            Back to drops
          </Link>
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
          {stepConfig.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  isStepActive(step.id) || isStepComplete(step.id)
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-500 border-gray-300"
                }`}
              >
                {step.id}
              </div>
              <span
                className={
                  isStepActive(step.id) || isStepComplete(step.id)
                    ? "text-gray-900"
                    : "text-gray-400"
                }
              >
                {step.label}
              </span>
              {idx < stepConfig.length - 1 && (
                <div className="h-px w-6 bg-gray-200" />
              )}
            </div>
          ))}
        </div>

        {message && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
            {message}
          </div>
        )}

        {enrichedItems.length === 0 ? (
          <div className="space-y-3 pt-4">
            <p className="text-sm text-gray-600">
              Your bag is empty. Once you add a pair, it will show up here.
            </p>
            <Link
              href="/products"
              className="inline-flex px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900"
            >
              Browse drops
            </Link>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-8 pt-2">
            {/* LEFT SIDE: ITEMS + ADDRESS */}
            <div className="w-full md:w-2/3 space-y-6">
              {/* PRODUCT LIST */}
              <div className="space-y-3">
                {enrichedItems.map((ci) => {
                  const p = ci.product;
                  const price = p ? Number(p.price || 0) : 0;
                  const imageUrl = p?.imageUrl
                    ? p.imageUrl.startsWith("http")
                      ? p.imageUrl
                      : `${apiBase}${p.imageUrl}`
                    : null;

                  return (
                    <div
                      key={ci.productId}
                      className="group rounded-3xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center"
                    >
                      <div className="w-full sm:w-32">
                        <div className="w-full aspect-square rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={p?.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <span className="text-[9px] uppercase tracking-[0.22em] text-gray-400">
                              Sneaks-up
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-gray-900">
                              {p?.name}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              ${price.toFixed(2)}
                            </p>
                            {p?.description && (
                              <p className="text-[11px] text-gray-400 line-clamp-2 max-w-xs">
                                {p.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemove(ci.productId)}
                            className="text-[10px] text-gray-500 hover:text-black underline underline-offset-2"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() =>
                              handleUpdateQuantity(
                                ci.productId,
                                ci.quantity - 1
                              )
                            }
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-black text-lg leading-none font-bold hover:bg-gray-300 transition"
                          >
                            −
                          </button>
                          <span className="text-base font-semibold text-gray-900 min-w-[20px] text-center">
                            {ci.quantity}
                          </span>
                          <button
                            onClick={() =>
                              handleUpdateQuantity(
                                ci.productId,
                                ci.quantity + 1
                              )
                            }
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-black text-lg leading-none font-bold hover:bg-gray-300 transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ADDRESS FORM (Step 2+) */}
              {checkoutStep >= 2 && (
                <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm px-4 py-5 sm:px-6 sm:py-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2">
                      <span>📍</span>
                      Shipping address
                    </h3>
                    {checkoutStep > 2 && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 border border-emerald-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Confirmed
                      </span>
                    )}
                  </div>

                  <div
                    className={`space-y-5 ${
                      checkoutStep > 2
                        ? "opacity-60 pointer-events-none"
                        : ""
                    }`}
                  >
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-[0.2em] mb-2">
                        Street address
                      </label>
                      <input
                        type="text"
                        name="street"
                        value={address.street}
                        onChange={handleAddressChange}
                        placeholder="123 Sneaker St, Apt 4"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-black outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-[0.2em] mb-2">
                          City
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={address.city}
                          onChange={handleAddressChange}
                          placeholder="Istanbul"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-black outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-[0.2em] mb-2">
                          Postal code
                        </label>
                        <input
                          type="text"
                          name="zip"
                          value={address.zip}
                          onChange={handleAddressChange}
                          placeholder="34000"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-black outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDE: SUMMARY & ACTIONS */}
            <div className="w-full md:w-1/3 h-fit md:sticky md:top-10">
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Order summary
                  </h3>
                  <span className="text-[11px] text-gray-500">
                    {enrichedItems.length} item
                    {enrichedItems.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Shipping</span>
                    <span>Calculated at dispatch</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">
                    Total
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>

                {paymentError && (
                  <p className="text-red-600 text-xs font-semibold bg-red-50 p-3 rounded-xl border border-red-100">
                    {paymentError}
                  </p>
                )}

                {/* STEP 1: CART REVIEW */}
                {checkoutStep === 1 && (
                  <button
                    onClick={handleProceedToAddress}
                    className="w-full py-3 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all shadow-lg"
                  >
                    {user ? "Proceed to shipping" : "Log in to checkout"}
                  </button>
                )}

                {/* STEP 2: ADDRESS CONFIRM */}
                {checkoutStep === 2 && (
                  <>
                    <button
                      onClick={handleProceedToPayment}
                      className="w-full py-3 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all shadow-lg mb-2"
                    >
                      Confirm address
                    </button>
                    <button
                      onClick={() => setCheckoutStep(1)}
                      className="w-full py-2 text-[11px] font-semibold text-gray-500 hover:text-black underline underline-offset-2"
                    >
                      Back to bag
                    </button>
                  </>
                )}

                {/* STEP 3: PAYMENT */}
                {checkoutStep === 3 && (
                  <div className="space-y-4 pt-2 border-t border-gray-100 mt-2">
                    <h4 className="font-semibold text-xs text-gray-900 flex items-center gap-2 uppercase tracking-[0.18em]">
                      <span>💳</span> Payment details
                    </h4>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-gray-700">
                        Card holder name
                      </label>
                      <input
                        type="text"
                        value={cardName}
                        onChange={handleNameChange}
                        placeholder="e.g. John Doe"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        Letters only – matches card.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-gray-700">
                        Card number
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="0000 0000 0000 0000"
                        maxLength={16}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        Numbers only – demo checkout, no real charge.
                      </p>
                    </div>

                    <button
                      onClick={finalizeOrder}
                      disabled={placingOrder}
                      className="w-full py-3 rounded-full bg-emerald-600 text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-emerald-700 transition-colors disabled:bg-gray-400 shadow-md mt-1"
                    >
                      {placingOrder ? "Processing…" : "Pay now"}
                    </button>

                    <button
                      onClick={() => setCheckoutStep(2)}
                      className="w-full py-2 text-[11px] font-semibold text-gray-500 hover:text-black underline underline-offset-2"
                    >
                      Back to shipping
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
