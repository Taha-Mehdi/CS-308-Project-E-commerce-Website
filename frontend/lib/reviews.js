"use client";

const STORAGE_KEY = "sneaksup_reviews";

function safeParse(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadAll() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return safeParse(raw);
}

function persist(reviews) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

export function getReviewsByProduct(productId) {
  const all = loadAll();
  return all.filter((r) => r.productId === Number(productId));
}

export function getAllReviews() {
  return loadAll();
}

export function addReview({ productId, rating, comment, userEmail, productName }) {
  const all = loadAll();
  const id = Date.now() + Math.floor(Math.random() * 1e6);
  const review = {
    id,
    productId: Number(productId),
    rating: Number(rating),
    comment,
    userEmail: userEmail || "guest",
    productName: productName || "",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  all.push(review);
  persist(all);
  return review;
}

export function updateReviewStatus(id, status) {
  const all = loadAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], status };
  persist(all);
  return all[idx];
}
