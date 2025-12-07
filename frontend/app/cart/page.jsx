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

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

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
    country: "Turkey"
  });

  // --- PAYMENT STATE ---
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

  // --- ACTIONS ---
  async function handleUpdateQuantity(productId, newQty) {
    if (newQty <= 0) return handleRemove(productId);
    if (!user) {
      const localCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
      const updated = localCart.map(item =>
          item.productId === productId ? { ...item, quantity: newQty } : item
      );
      localStorage.setItem("guestCart", JSON.stringify(updated));
      setCartItems(updated);
      window.dispatchEvent(new Event("cart-updated"));
      return;
    }
    try {
      setMessage("");
      await updateCartItemApi(productId, newQty);
      setCartItems((prev) =>
          prev.map((ci) => ci.productId === productId ? { ...ci, quantity: newQty } : ci)
      );
      window.dispatchEvent(new Event("cart-updated"));
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
      window.dispatchEvent(new Event("cart-updated"));
      return;
    }
    try {
      setMessage("");
      await removeFromCartApi(productId);
      setCartItems((prev) => prev.filter((ci) => ci.productId !== productId));
      window.dispatchEvent(new Event("cart-updated"));
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
    setAddress(prev => ({ ...prev, [name]: value }));
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
    if (!user) { router.push("/login"); return; }
    if (enrichedItems.length === 0) { setMessage("Your bag is empty."); return; }
    setCheckoutStep(2);
  }

  // Step 2 -> Step 3
  function handleProceedToPayment() {
    if (!address.street || !address.city || !address.zip) {
      setPaymentError("Please fill in all address fields.");
      return;
    }
    setPaymentError("");
    setCheckoutStep(3);
  }

  // Step 3 -> Step 4 (Finalize)
  async function finalizeOrder() {
    if (!cardName || cardNumber.length < 12) {
      setPaymentError("Please enter a valid Name and Card Number.");
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
      localStorage.removeItem("guestCart");
      window.dispatchEvent(new Event("cart-updated"));

      setCheckoutStep(4);

    } catch (err) {
      handleApiError(err);
    } finally {
      setPlacingOrder(false);
    }
  }

  if (loading) {
    return <SiteLayout><div className="space-y-5"><p>Loading bag...</p></div></SiteLayout>;
  }

  // === INVOICE SCREEN (Step 4) ===
  if (checkoutStep === 4) {
    return (
        <SiteLayout>
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="bg-white w-full max-w-2xl p-10 rounded-xl shadow-2xl border border-gray-200">

              <div className="text-center mb-8 border-b pb-6">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <h2 className="text-3xl font-extrabold text-black tracking-tight">PAYMENT SUCCESSFUL</h2>
                <p className="text-gray-500 mt-2 font-medium">Thank you for your purchase!</p>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Shipped To</p>
                  <p className="text-lg font-bold text-black">{user?.fullName || "Valued Customer"}</p>
                  <p className="text-sm text-gray-800 font-medium">{address.street}</p>
                  <p className="text-sm text-gray-800 font-medium">{address.city}, {address.zip}</p>
                  <p className="text-sm text-gray-800 font-medium">{address.country}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Invoice Info</p>
                  <p className="text-sm font-bold text-black">Order #: <span className="font-mono">{lastOrderId}</span></p>
                  <p className="text-sm font-bold text-black">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-sm font-bold text-green-600 mt-1">STATUS: PAID</p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8 flex justify-between items-center">
                <span className="text-lg font-bold text-black">TOTAL PAID</span>
                <span className="text-3xl font-extrabold text-black">${finalTotal.toFixed(2)}</span>
              </div>

              <div className="text-center">
                <button onClick={() => window.location.reload()} className="bg-black text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg">
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </SiteLayout>
    );
  }

  // === MAIN CART UI ===
  return (
      <SiteLayout>
        <div className="space-y-6">
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
                <Link href="/products" className="inline-flex px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900">
                  Browse drops
                </Link>
              </div>
          ) : (
              <div className="flex flex-col md:flex-row gap-8">

                {/* --- LEFT SIDE --- */}
                <div className="w-full md:w-2/3 space-y-6">
                  {/* PRODUCT LIST */}
                  <div className="space-y-3">
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
                              <div className="flex items-center gap-3 pt-3">
                                <button onClick={() => handleUpdateQuantity(ci.productId, ci.quantity - 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-black font-bold hover:bg-gray-300 transition">-</button>
                                <span className="text-base font-bold text-black min-w-[20px] text-center">{ci.quantity}</span>
                                <button onClick={() => handleUpdateQuantity(ci.productId, ci.quantity + 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-black font-bold hover:bg-gray-300 transition">+</button>
                              </div>
                            </div>
                          </div>
                      );
                    })}
                  </div>

                  {/* --- ADDRESS FORM (Step 2) --- */}
                  {checkoutStep >= 2 && (
                      <div className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm animate-fade-in">
                        <h3 className="text-xl font-bold text-black mb-6 flex items-center gap-2">
                          <span>📍</span> Shipping Address
                          {checkoutStep > 2 && <span className="text-green-600 text-xs ml-auto font-bold uppercase tracking-wider">✓ Confirmed</span>}
                        </h3>

                        <div className={`space-y-5 ${checkoutStep > 2 ? 'opacity-50 pointer-events-none' : ''}`}>
                          <div>
                            <label className="block text-xs font-bold text-black uppercase tracking-widest mb-2">Street Address</label>
                            <input
                                type="text"
                                name="street"
                                value={address.street}
                                onChange={handleAddressChange}
                                placeholder="123 Sneaker St, Apt 4"
                                className="w-full p-4 rounded-xl border border-gray-300 bg-white text-black font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-black outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-black uppercase tracking-widest mb-2">City</label>
                              <input
                                  type="text"
                                  name="city"
                                  value={address.city}
                                  onChange={handleAddressChange}
                                  placeholder="XYZ"
                                  className="w-full p-4 rounded-xl border border-gray-300 bg-white text-black font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-black outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-black uppercase tracking-widest mb-2">Postal Code</label>
                              <input
                                  type="text"
                                  name="zip"
                                  value={address.zip}
                                  onChange={handleAddressChange}
                                  placeholder="34000"
                                  className="w-full p-4 rounded-xl border border-gray-300 bg-white text-black font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-black outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                  )}
                </div>

                {/* --- RIGHT SIDE: SUMMARY & ACTIONS --- */}
                <div className="w-full md:w-1/3 h-fit sticky top-10">
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

                    {paymentError && <p className="text-red-600 text-xs font-bold bg-red-50 p-3 mb-4 rounded-lg border border-red-100">{paymentError}</p>}

                    {/* --- STEP 1: CART REVIEW --- */}
                    {checkoutStep === 1 && (
                        <button
                            onClick={handleProceedToAddress}
                            className="w-full py-3 rounded-full bg-black text-white text-xs font-bold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all shadow-lg"
                        >
                          {user ? "Proceed to Shipping" : "Log in to Checkout"}
                        </button>
                    )}

                    {/* --- STEP 2: ADDRESS REVIEW --- */}
                    {checkoutStep === 2 && (
                        <>
                          <button
                              onClick={handleProceedToPayment}
                              className="w-full py-3 rounded-full bg-black text-white text-xs font-bold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all shadow-lg mb-2"
                          >
                            Confirm Address
                          </button>
                          <button
                              onClick={() => setCheckoutStep(1)}
                              className="w-full py-2 text-xs font-bold text-gray-500 hover:text-black underline"
                          >
                            Back to Cart
                          </button>
                        </>
                    )}

                    {/* --- STEP 3: PAYMENT --- */}
                    {checkoutStep === 3 && (
                        <div className="animate-fade-in space-y-4 pt-2 border-t mt-2">
                          <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                            <span>💳</span> Payment Details
                          </h4>

                          <div>
                            <label className="block text-xs font-bold text-black mb-1">Card Holder Name</label>
                            <input type="text" value={cardName} onChange={handleNameChange} placeholder="e.g. John Doe"
                                   className="w-full p-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-black font-medium"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Letters only</p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-black mb-1">Card Number</label>
                            <input type="text" value={cardNumber} onChange={handleCardNumberChange} placeholder="0000 0000 0000 0000" maxLength={16}
                                   className="w-full p-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-black font-medium"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Integers only</p>
                          </div>

                          <button onClick={finalizeOrder} disabled={placingOrder}
                                  className="w-full py-3 rounded-full bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors disabled:bg-gray-400 shadow-md mt-2"
                          >
                            {placingOrder ? "Processing..." : "Pay Now"}
                          </button>

                          <button
                              onClick={() => setCheckoutStep(2)}
                              className="w-full py-2 text-xs font-bold text-gray-500 hover:text-black underline"
                          >
                            Back to Address
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