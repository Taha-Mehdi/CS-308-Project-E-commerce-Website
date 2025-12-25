const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export async function parseJsonSafe(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getStoredTokens() {
  if (typeof window === "undefined") return { token: null, refreshToken: null };

  const token = localStorage.getItem("token"); // access token
  const refreshToken = localStorage.getItem("refreshToken"); // refresh token
  return { token, refreshToken };
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

async function refreshAccessToken() {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) throw new Error("No refresh token available");

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const message = data?.message || "Failed to refresh token";
    throw new Error(message);
  }

  setStoredTokens(data.token, data.refreshToken);

  return {
    token: data.token,
    refreshToken: data.refreshToken,
    user: data.user,
  };
}

export async function apiRequest(
  path,
  { method = "GET", body, headers = {}, auth = false } = {}
) {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  let { token } = getStoredTokens();

  const baseHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth) {
    if (token) baseHeaders["Authorization"] = `Bearer ${token}`;
    else {
      const error = new Error("Not authenticated");
      error.status = 401;
      throw error;
    }
  }

  const doFetch = async (overrideHeaders) => {
    const res = await fetch(url, {
      method,
      headers: overrideHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await parseJsonSafe(res);
    return { res, data };
  };

  let { res, data } = await doFetch(baseHeaders);

  if (res.ok) return data;

  if (res.status !== 401 || !auth) {
    const error = new Error(data?.message || "API request failed");
    error.status = res.status;
    error.data = data;
    throw error;
  }

  const message = data?.message || "";
  if (message === "Token expired") {
    try {
      const refreshed = await refreshAccessToken();
      token = refreshed.token;

      const retryHeaders = { ...baseHeaders, Authorization: `Bearer ${token}` };
      const retry = await doFetch(retryHeaders);

      if (retry.res.ok) return retry.data;

      const retryError = new Error(
        retry.data?.message || "API request failed after refresh"
      );
      retryError.status = retry.res.status;
      retryError.data = retry.data;
      throw retryError;
    } catch (refreshError) {
      clearStoredTokens();
      const error = new Error(refreshError.message || "Failed to refresh session");
      error.status = 401;
      throw error;
    }
  }

  clearStoredTokens();
  const finalError = new Error(message || "Unauthorized");
  finalError.status = 401;
  finalError.data = data;
  throw finalError;
}

// PDF helper (auth)
export async function fetchPdfWithAuth(path) {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const { token } = getStoredTokens();

  if (!token) {
    const err = new Error("Not authenticated");
    err.status = 401;
    throw err;
  }

  // Try once; if expired, refresh and retry
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // If token expired, refresh and retry
  if (res.status === 401) {
    const ct = res.headers.get("content-type") || "";
    let data = null;
    if (ct.includes("application/json")) data = await parseJsonSafe(res);

    if (data?.message === "Token expired") {
      const refreshed = await refreshAccessToken();
      const newToken = refreshed.token;

      res = await fetch(url, {
        headers: { Authorization: `Bearer ${newToken}` },
      });
    }
  }

  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    let msg = "PDF request failed";
    if (ct.includes("application/json")) {
      const json = await parseJsonSafe(res);
      if (json?.message) msg = json.message;
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/pdf")) {
    const err = new Error("Unexpected PDF response from server");
    err.status = 500;
    throw err;
  }

  return res.blob();
}

// Auth
export async function loginApi(credentials) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: credentials,
    auth: false,
  });

  setStoredTokens(data.token, data.refreshToken);
  return data;
}

export async function registerApi(payload) {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: payload,
    auth: false,
  });

  setStoredTokens(data.token, data.refreshToken);
  return data;
}

export async function getMeApi() {
  return apiRequest("/auth/me", { method: "GET", auth: true });
}

// Products
export async function getProductsApi() {
  return apiRequest("/products", { method: "GET", auth: false });
}

export async function getProductApi(id) {
  return apiRequest(`/products/${id}`, { method: "GET", auth: false });
}

// Cart / Orders
export async function addToCartApi(payload) {
  return apiRequest("/cart/add", { method: "POST", body: payload, auth: true });
}

export async function getCartApi() {
  return apiRequest("/cart", { method: "GET", auth: true });
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

export async function createOrderApi(items) {
  return apiRequest("/orders", {
    method: "POST",
    auth: true,
    body: { items },
  });
}

// Analytics / Invoices (NEW)
export async function getAnalyticsSummaryApi(from, to) {
  const params = new URLSearchParams({ from, to });
  return apiRequest(`/analytics/summary?${params.toString()}`, {
    method: "GET",
    auth: true,
  });
}

export async function getInvoicesRangeApi(from, to) {
  const params = new URLSearchParams({ from, to });
  return apiRequest(`/invoice?${params.toString()}`, {
    method: "GET",
    auth: true,
  });
}

export async function downloadInvoicePdfBlob(orderId) {
  return fetchPdfWithAuth(`/invoice/${orderId}`);
}

// Reviews
export async function getProductReviewsApi(id) {
  return apiRequest(`/products/${id}/reviews`, { method: "GET", auth: false });
}

export async function addProductReviewApi(id, data) {
  return apiRequest(`/products/${id}/reviews`, {
    method: "POST",
    body: data,
    auth: true,
  });
}

// --- WISHLIST ---
export async function getWishlistApi() {
  return apiRequest("/wishlist", { method: "GET", auth: true });
}

export async function addToWishlistApi(productId) {
  return apiRequest(`/wishlist/${productId}`, { method: "POST", auth: true });
}

export async function removeFromWishlistApi(productId) {
  return apiRequest(`/wishlist/${productId}`, { method: "DELETE", auth: true });
}

// --- DISCOUNTS ---
// Backend endpoint:
//   POST /products/discount
// Body: { productIds: number[], discountRate: number }  // e.g. 15 for 15%
// Send 0 to clear discount (restore originalPrice)
export async function applyDiscountApi({ productIds, discountRate }) {
  return apiRequest("/products/discount", {
    method: "POST",
    auth: true,
    body: { productIds, discountRate },
  });
}
