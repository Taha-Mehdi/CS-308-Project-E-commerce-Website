"use client";

import { useEffect, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import ProductCard from "../../components/ProductCard";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadProducts() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/products`
      );
      const data = await res.json();

      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <SiteLayout>
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          All Products
        </h1>

        {loading ? (
          <p className="text-sm text-gray-500">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-500">
            No products available. Add some via backend admin.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
