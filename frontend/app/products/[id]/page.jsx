"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SiteLayout from "../../../components/SiteLayout";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState("");

  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/products/${id}`
        );
        if (!res.ok) {
          setError("Product not found");
          setProduct(null);
        } else {
          const data = await res.json();
          setProduct(data);
        }
      } catch (err) {
        console.error("Failed to load product:", err);
        setError("Failed to load product");
      } finally {
        setLoadingProduct(false);
      }
    }

    if (id) loadProduct();
  }, [id]);

  async function handleAddToCart() {
    setAddMessage("");
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    if (!token) {
      setAddMessage("Please login to add items to your cart.");
      return;
    }

    try {
      setAdding(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/cart/add`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: product.id,
            quantity: Number(quantity) || 1,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setAddMessage(data.message || "Failed to add to cart.");
      } else {
        setAddMessage("Added to cart.");
      }
    } catch (err) {
      console.error("Add to cart error:", err);
      setAddMessage("Failed to add to cart.");
    } finally {
      setAdding(false);
    }
  }

  const price =
    product && product.price
      ? typeof product.price === "string"
        ? product.price
        : product.price.toString()
      : "0.00";

  return (
    <SiteLayout>
      {loadingProduct ? (
        <p className="text-sm text-gray-500">Loading product…</p>
      ) : error || !product ? (
        <div className="space-y-3">
          <p className="text-sm text-red-600">{error || "Product not found"}</p>
          <button
            onClick={() => router.push("/products")}
            className="inline-flex text-xs text-gray-700 underline underline-offset-4"
          >
            Back to products
          </button>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Image / visual placeholder */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
              <span className="text-[11px] tracking-wide text-gray-500 uppercase">
                Product Image
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.24em] text-gray-500 uppercase">
                Product
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
                {product.name}
              </h1>
            </div>

            <p className="text-sm text-gray-600">
              {product.description || "No description provided."}
            </p>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                ${price}
              </p>
              <p className="text-xs text-gray-500">
                {product.stock > 0
                  ? `In stock · ${product.stock} available`
                  : "Out of stock"}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-600" htmlFor="quantity">
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring focus:ring-gray-300 bg-white"
                />
              </div>

              <button
                onClick={handleAddToCart}
                disabled={adding || product.stock <= 0}
                className="inline-flex items-center px-4 py-2.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {adding ? "Adding…" : "Add to cart"}
              </button>

              {addMessage && (
                <p className="text-xs text-gray-600">{addMessage}</p>
              )}
            </div>

            <button
              onClick={() => router.push("/products")}
              className="inline-flex text-[11px] text-gray-700 underline underline-offset-4 mt-4"
            >
              Back to all products
            </button>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
