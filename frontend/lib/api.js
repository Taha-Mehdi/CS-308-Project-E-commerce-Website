const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

/* -------------------------
   Token storage
------------------------- */
function getStoredTokens() {
  if (typeof window === "undefined") return { token: null, refreshToken: null };
  return {
    token: localStorage.getItem("token"),
    refreshToken: localStorage.getItem("refreshToken"),
  };
}

function setStoredTokens(token, refreshToken) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("token", token);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
}

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
}

/* -------------------------
   Fetch helper
------------------------- */
export async function apiRequest(
    path,
    { method = "GET", body, auth = false, headers = {} } = {}
) {
  const url = `${API_BASE_URL}${path}`;

  const finalHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth) {
    const { token } = getStoredTokens();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = new Error(data?.message || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/* -------------------------
   Invoice download helper (PDF)
------------------------- */
export async function downloadInvoicePdfBlob(orderId) {
  const url = `${API_BASE_URL}/invoice/${orderId}`;

  const { token } = getStoredTokens();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const err = new Error("Failed to download invoice");
    err.status = res.status;
    throw err;
  }
  return await res.blob();
}

/* =========================
   Auth
========================= */
export async function loginApi(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  setStoredTokens(data?.token, data?.refreshToken);
  return data;
}

export async function registerApi(payload) {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: payload,
  });

  setStoredTokens(data?.token, data?.refreshToken);
  return data;
}

export async function getMeApi() {
  return apiRequest("/auth/me", { auth: true });
}

/* =========================
   Products
========================= */
export async function getProductsApi() {
  return apiRequest("/products");
}

export async function getProductApi(id) {
  return apiRequest(`/products/${id}`);
}

/* =========================
   Cart
========================= */
export async function getCartApi() {
  return apiRequest("/cart", { auth: true });
}

// supports addToCartApi(productId, qty) OR addToCartApi({productId, quantity})
export async function addToCartApi(arg1, arg2 = 1) {
  let productId;
  let quantity;

  if (typeof arg1 === "object" && arg1 !== null) {
    productId = arg1.productId;
    quantity = arg1.quantity ?? 1;
  } else {
    productId = arg1;
    quantity = arg2;
  }

  // ✅ FIXED: Point to /cart/add (POST) matches backend routes/cart.js
  return apiRequest("/cart/add", {
    method: "POST",
    auth: true,
    body: { productId, quantity },
  });
}

export async function updateCartItemApi(productId, quantity) {
  // ✅ FIXED: Point to /cart/update (PUT) matches backend routes/cart.js
  // Also ensures body contains productId, as backend requires it in body
  return apiRequest(`/cart/update`, {
    method: "PUT",
    auth: true,
    body: { productId, quantity },
  });
}

export async function removeFromCartApi(productId) {
  // ✅ FIXED: Point to /cart/remove/:productId (DELETE) matches backend routes/cart.js
  return apiRequest(`/cart/remove/${productId}`, {
    method: "DELETE",
    auth: true,
  });
}

/* =========================
   Orders
========================= */
export async function createOrderApi(items, shippingAddress, paymentMethod) {
  // paymentMethod optional: "credit_card" | "account"
  return apiRequest("/orders", {
    method: "POST",
    auth: true,
    body: paymentMethod
        ? { items, shippingAddress, paymentMethod }
        : { items, shippingAddress },
  });
}

export async function getMyOrdersApi() {
  return apiRequest("/orders/my", { auth: true });
}

export async function cancelOrderApi(orderId) {
  return apiRequest(`/orders/${orderId}/cancel`, { method: "POST", auth: true });
}

export async function refundOrderApi(orderId) {
  return apiRequest(`/orders/${orderId}/refund`, { method: "POST", auth: true });
}

/* =========================
   Returns (customer + sales manager)
   IMPORTANT: These routes live under /orders in your backend.
========================= */

/**
 * Customer requests a return for a specific order item.
 * POST /orders/:orderId/items/:orderItemId/return-request
 */
export async function requestReturnForItemApi(orderId, orderItemId, reason) {
  return apiRequest(`/orders/${orderId}/items/${orderItemId}/return-request`, {
    method: "POST",
    auth: true,
    body: reason ? { reason } : {},
  });
}

/**
 * Customer lists own return requests.
 * GET /orders/returns/my
 */
export async function getMyReturnRequestsApi() {
  return apiRequest("/orders/returns/my", { auth: true });
}

/**
 * Sales manager lists all return requests.
 * GET /orders/returns
 */
export async function listReturnRequestsApi() {
  return apiRequest("/orders/returns", { auth: true });
}

/**
 * Sales manager decides on a return request.
 * PATCH /orders/returns/:returnId/decision
 * body: { decision: "approve" | "reject", note?: string }
 */
export async function decideReturnRequestApi(returnId, decision, note) {
  return apiRequest(`/orders/returns/${returnId}/decision`, {
    method: "PATCH",
    auth: true,
    body: note ? { decision, note } : { decision },
  });
}

/**
 * Sales manager marks received.
 * Backend performs: restock + refund + email + status="refunded"
 * PATCH /orders/returns/:returnId/receive
 */
export async function markReturnReceivedApi(returnId) {
  return apiRequest(`/orders/returns/${returnId}/receive`, {
    method: "PATCH",
    auth: true,
  });
}

/* =========================
   Wishlist
========================= */
export async function getWishlistApi() {
  return apiRequest("/wishlist", { auth: true });
}

export async function addToWishlistApi(productId) {
  return apiRequest("/wishlist", {
    method: "POST",
    auth: true,
    body: { productId },
  });
}

export async function removeFromWishlistApi(productId) {
  return apiRequest(`/wishlist/${productId}`, {
    method: "DELETE",
    auth: true,
  });
}

/* =========================
   Reviews
========================= */
export async function getProductReviewsApi(productId) {
  return apiRequest(`/reviews/${productId}`);
}

export async function addProductReviewApi(productId, payload) {
  return apiRequest(`/reviews/${productId}`, {
    method: "POST",
    auth: true,
    body: payload,
  });
}

/* =========================
   Analytics (sales manager)
========================= */
export async function getAnalyticsSummaryApi(from, to) {
  const q = new URLSearchParams({ from, to }).toString();
  return apiRequest(`/analytics/summary?${q}`, { auth: true });
}

/* =========================
   Invoices (sales manager)
========================= */
export async function getInvoicesRangeApi(from, to) {
  const q = new URLSearchParams({ from, to }).toString();
  return apiRequest(`/invoice?${q}`, { auth: true });
}

/* =========================
   Discounts (sales manager)
========================= */
export async function applyDiscountApi({ productIds, discountRate }) {
  return apiRequest("/products/discounts", {
    method: "POST",
    auth: true,
    body: { productIds, discountRate },
  });
}

/* =========================
   Chat
========================= */

export async function linkGuestChatApi(guestToken) {
  if (!guestToken) return null;

  return apiRequest("/chat/link", {
    method: "POST",
    auth: true,
    body: { guestToken },
  });
}

/**
 * Secure chat attachment download
 * - Uses Authorization header automatically (if logged in)
 * - For guests, server access depends on x-guest-token (handled outside this helper)
 *
 * NOTE: For guest download support too, we'll call this with headers containing x-guest-token
 * from the component (since api.js doesn't know guest token).
 */
export async function downloadChatAttachmentBlob(messageId, { headers = {} } = {}) {
  const url = `${API_BASE_URL}/chat/attachments/${messageId}`;

  const { token } = getStoredTokens();
  const finalHeaders = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers: finalHeaders, cache: "no-store" });
  if (!res.ok) {
    let msg = "Failed to download attachment";
    try {
      const data = await res.json();
      if (data?.message) msg = data.message;
    } catch {
      // ignore
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return await res.blob();
}

export function openBlobInNewTab(blob, filename = "attachment") {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);

  // open in new tab
  window.open(url, "_blank", "noopener,noreferrer");

  // cleanup later
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadChatAttachmentOpen(messageId, filename, opts) {
  const blob = await downloadChatAttachmentBlob(messageId, opts);
  openBlobInNewTab(blob, filename || "attachment");
  return true;
}