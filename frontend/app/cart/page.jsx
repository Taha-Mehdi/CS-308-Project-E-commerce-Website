"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SiteLayout from "../../components/SiteLayout";
import DripLink from "../../components/DripLink";
import { useAuth } from "../../context/AuthContext";
import {
  getCartApi,
  getProductsApi,
  updateCartItemApi,
  removeFromCartApi,
  apiRequest, // ✅ Added this import
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
        } catch {
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

    if (!loadingUser) loadCartAndProducts();
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
      const filtered = localCart.filter((item) => item.productId !== productId);
      window.localStorage.setItem("guestCart", JSON.stringify(filtered));
      setCartItems(filtered);
      if (isBrowser) window.dispatchEvent(new Event("cart-updated"));
      return;
    }

    // Logged in
    try {
      setMessage("");
      await removeFromCartApi(productId);
      setCartItems((prev) => prev.filter((ci) => ci.productId !== productId));
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

  function handleProceedToPayment() {
    if (!address.street || !address.city || !address.zip) {
      setPaymentError("Please fill in all shipping fields.");
      return;
    }
    setPaymentError("");
    setCheckoutStep(3);
  }

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
      // ✅ FIX: Construct the address string
      const shippingAddress = `${address.street}, ${address.city}, ${address.zip}, ${address.country}`;

      const itemsPayload = enrichedItems.map((ci) => ({
        productId: ci.productId,
        quantity: ci.quantity,
      }));

      // ✅ FIX: Send using apiRequest directly to include shippingAddress
      const data = await apiRequest("/orders", {
        method: "POST",
        auth: true,
        body: {
          items: itemsPayload,
          shippingAddress: shippingAddress // <-- This is what was missing
        }
      });

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

  const controlBase =
      "h-10 w-full rounded-full border border-border bg-white/5 text-[12px] text-gray-100 " +
      "placeholder:text-gray-400/70 px-4 backdrop-blur " +
      "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_45%,transparent)]";

  // --- LOADING ---
  if (loading || loadingUser) {
    return (
        <SiteLayout>
          <div className="py-10 space-y-6">
            <div className="rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]">
              <div className="h-5 w-44 rounded-full bg-white/10 animate-pulse" />
              <div className="mt-2 h-8 w-60 rounded-full bg-white/10 animate-pulse" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                  <div
                      key={i}
                      className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-4 shadow-[0_16px_60px_rgba(0,0,0,0.40)]"
                  >
                    <div className="w-full aspect-square rounded-[22px] bg-white/10 animate-pulse mb-4" />
                    <div className="h-4 w-2/3 rounded bg-white/10 animate-pulse mb-2" />
                    <div className="h-4 w-1/3 rounded bg-white/10 animate-pulse" />
                  </div>
              ))}
            </div>
          </div>
        </SiteLayout>
    );
  }

  // === STEP 4: SUCCESS ===
  if (checkoutStep === 4) {
    return (
        <SiteLayout>
          <div className="space-y-6 py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold tracking-[0.26em] uppercase text-gray-300/70">
                  Checkout
                </p>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  Payment confirmed
                </h1>
                <p className="text-xs text-gray-300/70">
                  Your pair is locked in. Tracking will appear in Orders.
                </p>
              </div>

              <DripLink
                  href="/products"
                  className="
                h-10 px-4 inline-flex items-center justify-center rounded-full
                border border-border bg-white/5 text-[11px] font-semibold
                uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10
                transition active:scale-[0.98]
              "
              >
                Back to drops
              </DripLink>
            </div>

            {/* Stepper */}
            <div className="rounded-full border border-white/10 bg-white/5 backdrop-blur p-2">
              <div className="flex flex-wrap items-center gap-2">
                {stepConfig.map((step) => {
                  const active = checkoutStep >= step.id;
                  return (
                      <div
                          key={step.id}
                          className={[
                            "inline-flex items-center gap-2 rounded-full px-4 py-2",
                            "text-[11px] font-semibold uppercase tracking-[0.18em]",
                            active
                                ? "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black"
                                : "bg-black/20 text-gray-200/70 border border-white/10",
                          ].join(" ")}
                      >
                    <span
                        className={[
                          "inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px]",
                          active ? "bg-black/30 text-white" : "bg-white/10 text-gray-300/70",
                        ].join(" ")}
                    >
                      {step.id}
                    </span>
                        {step.label}
                      </div>
                  );
                })}
              </div>
            </div>

            {/* Success card */}
            <div className="flex justify-center pt-2 pb-10">
              <div className="w-full max-w-2xl rounded-[28px] border border-border bg-black/25 backdrop-blur px-6 py-8 sm:px-10 sm:py-10 shadow-[0_18px_80px_rgba(0,0,0,0.45)] space-y-6">
                <div className="text-center space-y-3 border-b border-white/10 pb-6">
                  <div className="mx-auto w-14 h-14 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-200/80">
                    Paid
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                    Your pair is locked in
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-300/70 max-w-md mx-auto">
                    We’ve reserved your sneakers. Shipping updates will appear in your Orders.
                  </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300/70">
                      Shipped to
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {user?.fullName || "Valued Customer"}
                    </p>
                    <p className="text-xs text-gray-200/80">{address.street || "—"}</p>
                    <p className="text-xs text-gray-200/80">
                      {[address.city, address.zip].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-xs text-gray-200/80">
                      {address.country || "Turkey"}
                    </p>
                  </div>

                  <div className="space-y-2 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300/70">
                      Order details
                    </p>
                    <p className="text-xs text-gray-300/70">
                      Order #
                      <span className="ml-1 font-mono font-semibold text-gray-100">
                      {lastOrderId}
                    </span>
                    </p>
                    <p className="inline-flex items-center justify-end gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-200/80">
                      <span className="h-2 w-2 rounded-full bg-[var(--drip-accent)]" />
                      Confirmed
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300/70">
                      Total paid
                    </p>
                    <p className="text-[11px] text-gray-300/60">
                      Includes all items in your bag at checkout.
                    </p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-semibold text-foreground">
                    ${finalTotal.toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                      onClick={() => router.push("/products")}
                      className="
                    inline-flex items-center justify-center rounded-full
                    bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                    px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em]
                    text-black hover:opacity-95 transition active:scale-[0.98]
                  "
                  >
                    Continue shopping
                  </button>

                  <p className="text-[11px] text-gray-300/70">
                    Review anytime in{" "}
                    <span className="font-semibold text-gray-100">Orders</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SiteLayout>
    );
  }

  // === STEPS 1–3 ===
  return (
      <SiteLayout>
        <div className="space-y-6 py-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.26em] uppercase text-gray-300/70">
                Bag
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                Your picks
              </h1>
              <p className="text-xs text-gray-300/70">
                Review your drops, confirm shipping, then lock the order.
              </p>
            </div>

            <DripLink
                href="/products"
                className="
              h-10 px-4 inline-flex items-center justify-center rounded-full
              border border-border bg-white/5 text-[11px] font-semibold
              uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10
              transition active:scale-[0.98]
            "
            >
              Back to drops
            </DripLink>
          </div>

          {/* Stepper */}
          <div className="rounded-full border border-white/10 bg-white/5 backdrop-blur p-2">
            <div className="flex flex-wrap items-center gap-2">
              {stepConfig.map((step) => {
                const active = isStepActive(step.id) || isStepComplete(step.id);
                return (
                    <button
                        key={step.id}
                        type="button"
                        onClick={() => {
                          // allow going back only
                          if (step.id < checkoutStep) setCheckoutStep(step.id);
                        }}
                        className={[
                          "inline-flex items-center gap-2 rounded-full px-4 py-2",
                          "text-[11px] font-semibold uppercase tracking-[0.18em]",
                          "transition active:scale-[0.98]",
                          active
                              ? "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black"
                              : "bg-black/20 text-gray-200/70 border border-white/10",
                          step.id < checkoutStep ? "cursor-pointer" : "cursor-default",
                        ].join(" ")}
                    >
                  <span
                      className={[
                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px]",
                        active ? "bg-black/30 text-white" : "bg-white/10 text-gray-300/70",
                      ].join(" ")}
                  >
                    {step.id}
                  </span>
                      {step.label}
                    </button>
                );
              })}
            </div>
          </div>

          {message && (
              <div className="rounded-2xl border border-white/10 bg-black/25 backdrop-blur px-4 py-3 text-[11px] text-gray-200/80">
                {message}
              </div>
          )}

          {enrichedItems.length === 0 ? (
              <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-8 text-center">
                <p className="text-sm text-gray-200/80">
                  Your bag is empty. Add a pair and it will show up here.
                </p>
                <DripLink
                    href="/products"
                    className="
                mt-4 inline-flex items-center justify-center rounded-full
                bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em]
                text-black hover:opacity-95 transition active:scale-[0.98]
              "
                >
                  Browse drops
                </DripLink>
              </div>
          ) : (
              <div className="flex flex-col md:flex-row gap-6 pt-2">
                {/* LEFT: items + forms */}
                <div className="w-full md:w-2/3 space-y-6">
                  {/* ITEMS */}
                  <div className="space-y-4">
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
                              className="
                        group rounded-[28px] border border-border
                        bg-black/20 backdrop-blur p-4 sm:p-5
                        shadow-[0_16px_60px_rgba(0,0,0,0.40)]
                        flex flex-col sm:flex-row gap-4 sm:items-center
                      "
                          >
                            <div className="w-full sm:w-32">
                              <div className="w-full aspect-square rounded-[22px] bg-black/20 border border-white/10 overflow-hidden flex items-center justify-center">
                                {imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt={p?.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <span className="text-[9px] uppercase tracking-[0.22em] text-gray-300/60">
                              Sneaks-up
                            </span>
                                )}
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-2 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground line-clamp-1">
                                    {p?.name}
                                  </p>
                                  <p className="text-[11px] text-gray-300/70">
                                    ${price.toFixed(2)}
                                  </p>
                                  {p?.description && (
                                      <p className="text-[11px] text-gray-300/60 line-clamp-2 max-w-xl">
                                        {p.description}
                                      </p>
                                  )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleRemove(ci.productId)}
                                    className="text-[10px] text-gray-300/70 hover:text-gray-100 underline underline-offset-2"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="flex items-center justify-between gap-3 pt-2">
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                                  <button
                                      type="button"
                                      onClick={() =>
                                          handleUpdateQuantity(ci.productId, ci.quantity - 1)
                                      }
                                      className="
                                w-8 h-8 rounded-full border border-white/10 bg-black/30
                                text-white text-lg leading-none font-bold
                                hover:bg-white/10 transition active:scale-[0.98]
                              "
                                  >
                                    −
                                  </button>

                                  <span className="text-sm font-semibold text-gray-100 min-w-[20px] text-center">
                              {ci.quantity}
                            </span>

                                  <button
                                      type="button"
                                      onClick={() =>
                                          handleUpdateQuantity(ci.productId, ci.quantity + 1)
                                      }
                                      className="
                                w-8 h-8 rounded-full border border-white/10 bg-black/30
                                text-white text-lg leading-none font-bold
                                hover:bg-white/10 transition active:scale-[0.98]
                              "
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="text-right">
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-300/60">
                                    Line total
                                  </p>
                                  <p className="text-sm font-semibold text-foreground">
                                    ${(price * (ci.quantity || 0)).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                      );
                    })}
                  </div>

                  {/* SHIPPING (Step 2+) */}
                  {checkoutStep >= 2 && (
                      <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 sm:p-6 shadow-[0_16px_60px_rgba(0,0,0,0.40)] space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm sm:text-base font-semibold text-foreground">
                            Shipping address
                          </h3>

                          {checkoutStep > 2 && (
                              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-100 border border-white/10">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--drip-accent)]" />
                        Confirmed
                      </span>
                          )}
                        </div>

                        <div
                            className={`space-y-4 ${
                                checkoutStep > 2 ? "opacity-60 pointer-events-none" : ""
                            }`}
                        >
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300/70 mb-2">
                              Street
                            </label>
                            <input
                                type="text"
                                name="street"
                                value={address.street}
                                onChange={handleAddressChange}
                                placeholder="123 Sneaker St, Apt 4"
                                className={controlBase}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300/70 mb-2">
                                City
                              </label>
                              <input
                                  type="text"
                                  name="city"
                                  value={address.city}
                                  onChange={handleAddressChange}
                                  placeholder="Istanbul"
                                  className={controlBase}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300/70 mb-2">
                                Postal code
                              </label>
                              <input
                                  type="text"
                                  name="zip"
                                  value={address.zip}
                                  onChange={handleAddressChange}
                                  placeholder="34000"
                                  className={controlBase}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                  )}

                  {/* PAYMENT (Step 3) */}
                  {checkoutStep === 3 && (
                      <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 sm:p-6 shadow-[0_16px_60px_rgba(0,0,0,0.40)] space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm sm:text-base font-semibold text-foreground">
                            Payment details
                          </h3>
                          <span className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                      Demo checkout
                    </span>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300/70 mb-2">
                              Card holder
                            </label>
                            <input
                                type="text"
                                value={cardName}
                                onChange={handleNameChange}
                                placeholder="John Doe"
                                className={controlBase}
                            />
                            <p className="mt-2 text-[10px] text-gray-300/55">
                              Letters only – matches card.
                            </p>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300/70 mb-2">
                              Card number
                            </label>
                            <input
                                type="text"
                                value={cardNumber}
                                onChange={handleCardNumberChange}
                                placeholder="0000 0000 0000 0000"
                                maxLength={16}
                                className={controlBase}
                            />
                            <p className="mt-2 text-[10px] text-gray-300/55">
                              Numbers only – no real charge.
                            </p>
                          </div>
                        </div>
                      </div>
                  )}
                </div>

                {/* RIGHT: summary */}
                <div className="w-full md:w-1/3 h-fit md:sticky md:top-10">
                  <div className="rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)] space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">
                        Order summary
                      </h3>
                      <span className="text-[11px] text-gray-300/60">
                    {enrichedItems.length} item{enrichedItems.length !== 1 ? "s" : ""}
                  </span>
                    </div>

                    <div className="space-y-2 text-[12px] text-gray-200/75">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-300/55">
                        <span>Shipping</span>
                        <span>Calculated at dispatch</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-white/10">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-300/70">
                    Total
                  </span>
                      <span className="text-lg font-semibold text-foreground">
                    ${cartTotal.toFixed(2)}
                  </span>
                    </div>

                    {paymentError && (
                        <p className="text-[11px] font-semibold bg-white/10 px-4 py-3 rounded-2xl border border-white/10 text-[color-mix(in_oklab,var(--drip-accent)_70%,white)]">
                          {paymentError}
                        </p>
                    )}

                    {/* STEP ACTIONS */}
                    {checkoutStep === 1 && (
                        <button
                            onClick={handleProceedToAddress}
                            className="
                      w-full py-3 rounded-full
                      bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                      text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                      hover:opacity-95 transition active:scale-[0.98]
                    "
                        >
                          {user ? "Proceed to shipping" : "Log in to checkout"}
                        </button>
                    )}

                    {checkoutStep === 2 && (
                        <>
                          <button
                              onClick={handleProceedToPayment}
                              className="
                        w-full py-3 rounded-full
                        bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                        text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                        hover:opacity-95 transition active:scale-[0.98]
                      "
                          >
                            Confirm address
                          </button>

                          <button
                              type="button"
                              onClick={() => setCheckoutStep(1)}
                              className="w-full py-2 text-[11px] font-semibold text-gray-300/70 hover:text-gray-100 underline underline-offset-2"
                          >
                            Back to bag
                          </button>
                        </>
                    )}

                    {checkoutStep === 3 && (
                        <>
                          <button
                              onClick={finalizeOrder}
                              disabled={placingOrder}
                              className="
                        w-full py-3 rounded-full
                        bg-white text-black
                        text-[11px] font-semibold uppercase tracking-[0.18em]
                        hover:bg-gray-100 transition active:scale-[0.98]
                        disabled:opacity-60 disabled:cursor-not-allowed
                      "
                          >
                            {placingOrder ? "Processing…" : "Pay now"}
                          </button>

                          <button
                              type="button"
                              onClick={() => setCheckoutStep(2)}
                              className="w-full py-2 text-[11px] font-semibold text-gray-300/70 hover:text-gray-100 underline underline-offset-2"
                          >
                            Back to shipping
                          </button>
                        </>
                    )}

                    <div className="pt-2">
                      <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/55 text-center">
                        clean checkout • drip theme
                      </p>
                    </div>
                  </div>
                </div>
              </div>
          )}
        </div>
      </SiteLayout>
  );
}