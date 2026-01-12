"use client";

import { useEffect, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import ProductCard from "../../components/ProductCard";
import Skeleton from "../../components/Skeleton";
import DripLink from "../../components/DripLink";
import { useAuth } from "../../context/AuthContext";
import { getWishlistApi, removeFromWishlistApi, addToCartApi } from "../../lib/api";

export default function WishlistPage() {
    const { user, loadingUser } = useAuth();
    const [wishlist, setWishlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    const [movingToBag, setMovingToBag] = useState(new Set());
    const [removing, setRemoving] = useState(new Set());

    function withSet(setter, id, on) {
        setter((prev) => {
            const next = new Set(prev);
            if (on) next.add(id);
            else next.delete(id);
            return next;
        });
    }

    useEffect(() => {
        async function loadWishlist() {
            setLoading(true);
            try {
                const data = await getWishlistApi();
                setWishlist(Array.isArray(data?.products) ? data.products : []);
            } catch {
                setWishlist([]);
            } finally {
                setLoading(false);
            }
        }

        if (!loadingUser && user) loadWishlist();
        else if (!loadingUser && !user) setLoading(false);
    }, [loadingUser, user]);

    async function handleRemove(productId) {
        setMessage("");
        withSet(setRemoving, productId, true);
        try {
            await removeFromWishlistApi(productId);
            setWishlist((prev) => prev.filter((p) => p.id !== productId));
            setMessage("Removed from wishlist.");
        } catch {
            setMessage("Could not remove item.");
        } finally {
            withSet(setRemoving, productId, false);
        }
    }

    async function handleMoveToBag(productId) {
        setMessage("");
        withSet(setMovingToBag, productId, true);
        try {
            await addToCartApi({ productId, quantity: 1 });
            try {
                await removeFromWishlistApi(productId);
                setWishlist((prev) => prev.filter((p) => p.id !== productId));
            } catch {
                // ignore removal error
            }
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("cart-updated"));
            }
            setMessage("Added to bag.");
        } catch {
            setMessage("Could not add to bag.");
        } finally {
            withSet(setMovingToBag, productId, false);
        }
    }

    /* --- AUTH GATE --- */
    if (loadingUser) {
        return (
            <SiteLayout>
                <p className="text-sm text-gray-300/70">Checking your account…</p>
            </SiteLayout>
        );
    }

    if (!user) {
        return (
            <SiteLayout>
                <div className="py-6 space-y-4">
                    <h1 className="text-xl font-semibold text-white">Wishlist</h1>
                    <p className="text-sm text-gray-300/70">Please sign in to view your wishlist.</p>
                    <div className="flex gap-3">
                        <DripLink href="/login" className="px-5 py-2 rounded-full bg-white text-black text-xs font-bold uppercase tracking-wider">Login</DripLink>
                    </div>
                </div>
            </SiteLayout>
        );
    }

    return (
        <SiteLayout>
            <div className="space-y-8 py-6">
                <div className="flex items-end justify-between">
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gray-300/60">
                            Saved For Later
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight text-white">
                            Your Wishlist
                        </h1>
                    </div>
                    <DripLink
                        href="/products"
                        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-200/70 hover:text-white underline underline-offset-4"
                    >
                        Browse all
                    </DripLink>
                </div>

                {message && (
                    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/85">
                        {message}
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <Skeleton className="h-72 rounded-[28px]" />
                        <Skeleton className="h-72 rounded-[28px]" />
                    </div>
                ) : wishlist.length === 0 ? (
                    <div className="rounded-[28px] border border-white/10 bg-black/20 backdrop-blur p-8 text-center">
                        <p className="text-sm font-semibold text-white">Your wishlist is empty.</p>
                        <p className="mt-2 text-[12px] text-gray-300/70">
                            Keep track of drops you want to cop later.
                        </p>
                        <div className="mt-6">
                            <DripLink
                                href="/products"
                                className="inline-flex h-10 px-6 items-center justify-center rounded-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black text-[11px] font-semibold uppercase tracking-[0.18em]"
                            >
                                Start Browsing
                            </DripLink>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                        {wishlist.map((product) => {
                            const isMoving = movingToBag.has(product.id);
                            const isRemoving = removing.has(product.id);

                            return (
                                <div key={product.id} className="relative group/actions">
                                    <div className="transition-opacity duration-200 sm:group-hover/actions:opacity-30">
                                        <ProductCard product={product} />
                                    </div>

                                    <div className="absolute inset-0 hidden sm:flex items-center justify-center opacity-0 group-hover/actions:opacity-100 transition-all duration-200 z-10 p-4">
                                        <div className="flex flex-col gap-2 w-full max-w-[180px]">
                                            <button
                                                onClick={() => handleMoveToBag(product.id)}
                                                disabled={isMoving || isRemoving}
                                                className="w-full py-3 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
                                            >
                                                {isMoving ? "Adding..." : "Move to Bag"}
                                            </button>
                                            <button
                                                onClick={() => handleRemove(product.id)}
                                                disabled={isMoving || isRemoving}
                                                className="w-full py-3 rounded-full bg-black/80 border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 hover:border-red-500/50 transition-colors disabled:opacity-50"
                                            >
                                                {isRemoving ? "Removing..." : "Remove"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mobile Actions */}
                                    <div className="sm:hidden mt-2 flex gap-2">
                                        <button
                                            onClick={() => handleMoveToBag(product.id)}
                                            disabled={isMoving || isRemoving}
                                            className="flex-1 py-2 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white"
                                        >
                                            {isMoving ? "..." : "Add"}
                                        </button>
                                        <button
                                            onClick={() => handleRemove(product.id)}
                                            disabled={isMoving || isRemoving}
                                            className="px-4 py-2 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-400"
                                        >
                                            {isRemoving ? "..." : "✕"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </SiteLayout>
    );
}