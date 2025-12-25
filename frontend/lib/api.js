
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
   Helpers
------------------------- */
async function parseJsonSafe(res) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function refreshAccessToken() {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) {
    const err = new Error("No refresh token");
    err.status = 401;
    throw err;
  }

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const err = new Error(data?.message || "Refresh failed");
    err.status = res.status || 401;
    throw err;
  }

  setStoredTokens(data.token, data.refreshToken);
  return data.token;
}

/* -------------------------
   Role-aware redirect helper (client only)
------------------------- */
function redirectOnForbiddenDefault() {
  if (typeof window === "undefined") return;

  // Try to redirect based on stored user roleName if available
  try {
    const raw = localStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : null;
    const role = u?.roleName || u?.role || u?.role_name;

    if (role === "sales_manager") {
      window.location.href = "/sales-admin";
      return;
    }
    if (role === "admin" || role === "product_manager") {
      window.location.href = "/admin";
      return;
    }
  } catch {
    // ignore
  }

  // fallback
  window.location.href = "/";
}

/* -------------------------
   Core API wrapper
   - 401 + Token expired => refresh once
   - 403 => redirect & return null (prevents console spam)
------------------------- */
export async function apiRequest(
  path,
  { method = "GET", body, auth = false, headers = {}, onForbidden } = {}
) {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  let { token } = getStoredTokens();

  const reqHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth) {
    if (!token) {
      const err = new Error("Not authenticated");
      err.status = 401;
      throw err;
    }
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  async function doFetch(hdrs) {
    const res = await fetch(url, {
      method,
      headers: hdrs,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await parseJsonSafe(res);
    return { res, data };
  }

  let { res, data } = await doFetch(reqHeaders);

  if (res.ok) return data;

  // ✅ Global forbidden handling (role separated panels)
  if (res.status === 403) {
    if (typeof onForbidden === "function") {
      try {
        onForbidden({ status: 403, message: data?.message || "Access denied" });
      } catch {
        // ignore
      }
    } else {
      redirectOnForbiddenDefault();
    }

    // ✅ return null instead of throwing (prevents noisy uncaught errors)
    return null;
  }

  // Retry once if token expired
  if (auth && res.status === 401 && data?.message === "Token expired") {
    try {
      token = await refreshAccessToken();
      const retry = await doFetch({
        ...reqHeaders,
        Authorization: `Bearer ${token}`,
      });
      if (retry.res.ok) return retry.data;

      const err = new Error(retry.data?.message || "API request failed");
      err.status = retry.res.status;
      err.data = retry.data;
      throw err;
    } catch {
      clearStoredTokens();
      const err = new Error("Session expired. Please login again.");
      err.status = 401;
      throw err;
    }
  }

  const err = new Error(data?.message || "API request failed");
  err.status = res.status;
  err.data = data;

  if (res.status === 401) clearStoredTokens();
  throw err;
}

/* -------------------------
   PDF download helper (auth)
------------------------- */
export async function downloadInvoicePdfBlob(orderId) {
  const url = `${API_BASE_URL}/invoice/${orderId}`;
  let { token } = getStoredTokens();

  if (!token) {
    const err = new Error("Not authenticated");
    err.status = 401;
    throw err;
  }

  async function doFetch(t) {
    return fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${t}` },
    });
  }

  let res = await doFetch(token);

  // If expired -> refresh once -> retry
  if (res.status === 401) {
    const ct = res.headers.get("content-type") || "";
    let data = null;
    if (ct.includes("application/json")) data = await parseJsonSafe(res);

    if (data?.message === "Token expired") {
      try {
        token = await refreshAccessToken();
        res = await doFetch(token);
      } catch {
        clearStoredTokens();
        const err = new Error("Session expired. Please login again.");
        err.status = 401;
        throw err;
      }
    }
  }

  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    let msg = "Failed to download invoice";
    if (ct.includes("application/json")) {
      const data = await parseJsonSafe(res);
      if (data?.message) msg = data.message;
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/pdf")) {
    const err = new Error("Unexpected invoice response (not PDF)");
    err.status = 500;
    throw err;
  }

  return res.blob();
}

/* =========================
   Auth
========================= */
export async function loginApi(payload) {
  const data = await apiRequest("/auth/login", { method: "POST", body: payload });
  if (!data) return null;
  setStoredTokens(data.token, data.refreshToken);
  return data;
}

export async function registerApi(payload) {
  const data = await apiRequest("/auth/register", { method: "POST", body: payload });
  if (!data) return null;
  setStoredTokens(data.token, data.refreshToken);
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

export async function addToCartApi(payload) {
  return apiRequest("/cart/add", { method: "POST", body: payload, auth: true });
}

export async function updateCartItemApi(productId, quantity) {
  return apiRequest("/cart/update", {
    method: "PUT",
    auth: true,
    body: { productId, quantity },
  });
}

export async function removeFromCartApi(productId) {
  return apiRequest(`/cart/remove/${productId}`, {
    method: "DELETE",
    auth: true,
  });
}

/* =========================
   Orders
========================= */
export async function createOrderApi(items) {
  return apiRequest("/orders", {
    method: "POST",
    auth: true,
    body: { items },
  });
}

export async function getMyOrdersApi() {
  return apiRequest("/orders/my", { auth: true });
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
  return apiRequest("/wishlist", {
    method: "DELETE",
    auth: true,
    body: { productId },
  });
}

/* =========================
   Reviews
========================= */
export async function getProductReviewsApi(productId) {
  return apiRequest(`/products/${productId}/reviews`);
}

export async function addProductReviewApi(productId, review) {
  return apiRequest(`/products/${productId}/reviews`, {
    method: "POST",
    auth: true,
    body: review,
  });
}

/* =========================
   Sales Manager
========================= */
export async function getAnalyticsSummaryApi(from, to) {
  const q = new URLSearchParams({ from, to }).toString();
  return apiRequest(`/analytics/summary?${q}`, { auth: true });
}

export async function getInvoicesRangeApi(from, to) {
  const q = new URLSearchParams({ from, to }).toString();
  return apiRequest(`/invoice?${q}`, { auth: true });
}

export async function applyDiscountApi({ productIds, discountRate }) {
  return apiRequest("/products/discounts", {
    method: "POST",
    auth: true,
    body: { productIds, discountRate },
  });
}
