// frontend/lib/api.js

// Change this if your backend runs on a different URL or port
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
  if (token) {
    localStorage.setItem("token", token);
  }
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
}

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
}


async function refreshAccessToken() {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    // e.g. { message: "Refresh token expired" } or "Invalid refresh token"
    const message = data?.message || "Failed to refresh token";
    throw new Error(message);
  }

  // Backend response shape from auth.js:
  // { token, refreshToken, user }
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

  // Build initial headers
  const baseHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth) {
    if (token) {
      baseHeaders["Authorization"] = `Bearer ${token}`;
    } else {
      // If endpoint requires auth but we have no token at all
      const error = new Error("Not authenticated");
      error.status = 401;
      throw error;
    }
  }

  // Helper to actually perform fetch
  const doFetch = async (overrideHeaders) => {
    const res = await fetch(url, {
      method,
      headers: overrideHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await parseJsonSafe(res);

    return { res, data };
  };

  // 1st attempt
  let { res, data } = await doFetch(baseHeaders);

  // If OK, return directly
  if (res.ok) {
    return data;
  }

  // If not OK and not a 401, just throw
  if (res.status !== 401 || !auth) {
    const error = new Error(data?.message || "API request failed");
    error.status = res.status;
    error.data = data;
    throw error;
  }

  // If 401 with message "Token expired", try refresh once
  const message = data?.message || "";
  if (message === "Token expired") {
    try {
      const refreshed = await refreshAccessToken();
      token = refreshed.token;

      const retryHeaders = {
        ...baseHeaders,
        Authorization: `Bearer ${token}`,
      };

      const retry = await doFetch(retryHeaders);
      if (retry.res.ok) {
        return retry.data;
      }

      const retryError = new Error(
        retry.data?.message || "API request failed after refresh"
      );
      retryError.status = retry.res.status;
      retryError.data = retry.data;
      throw retryError;
    } catch (refreshError) {
      // Refresh failed → clear tokens and throw
      clearStoredTokens();
      const error = new Error(
        refreshError.message || "Failed to refresh session"
      );
      error.status = 401;
      throw error;
    }
  }

  // 401 but not "Token expired" (e.g. "Invalid token")
  clearStoredTokens();
  const finalError = new Error(message || "Unauthorized");
  finalError.status = 401;
  finalError.data = data;
  throw finalError;
}

// Auth
export async function loginApi(credentials) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: credentials,
    auth: false,
  });

  // backend returns: { token, refreshToken, user }
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
  return apiRequest("/auth/me", {
    method: "GET",
    auth: true,
  });
}

// Products
export async function getProductsApi() {
  return apiRequest("/products", {
    method: "GET",
    auth: false,
  });
}

export async function getProductByIdApi(id) {
  return apiRequest(`/products/${id}`, {
    method: "GET",
    auth: false,
  });
}

export async function addToCartApi(payload) {
  // payload: { productId, quantity, ... }
  return apiRequest("/cart/add", {
    method: "POST",
    body: payload,
    auth: true,
  });
}


export async function getCartApi() {
  return apiRequest("/cart", {
    method: "GET",
    auth: true,
  });
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
  // items: [{ productId, quantity }]
  return apiRequest("/orders", {
    method: "POST",
    auth: true,
    body: { items },
  });
}
