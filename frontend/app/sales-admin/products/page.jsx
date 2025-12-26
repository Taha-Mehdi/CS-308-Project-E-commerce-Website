"use client";

import { useEffect, useState, useMemo } from "react";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function panelClass() {
    return "rounded-[34px] border border-white/10 bg-white/[0.04] p-5 sm:p-6 shadow-2xl backdrop-blur-xl";
}

export default function SalesPricingPage() {
    const { user, loadingUser } = useAuth();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [query, setQuery] = useState("");

    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editPrice, setEditPrice] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (loadingUser) return;
        if (user?.roleName !== "sales_manager") {
            // Optional: Redirect if not sales manager
            return;
        }

        async function load() {
            try {
                const res = await fetch(`${apiBase}/products`);
                if (res.ok) setProducts(await res.json());
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user, loadingUser]);

    function startEdit(p) {
        setEditingId(p.id);
        setEditPrice(String(p.price));
    }

    async function handleSave(p) {
        const token = localStorage.getItem("token");
        setSaving(true);
        setMessage("");

        // We only change price, but API expects full object usually.
        // We send back existing values for other fields to keep them safe.
        try {
            const res = await fetch(`${apiBase}/products/${p.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...p, // Keep name, stock, etc.
                    price: Number(editPrice),
                    categoryId: p.categoryId // Ensure this is passed if needed
                })
            });

            if (res.ok) {
                const updated = await res.json();
                setProducts(prev => prev.map(x => x.id === p.id ? updated : x));
                setEditingId(null);
                setMessage("Price updated successfully.");
            } else {
                setMessage("Failed to update price.");
            }
        } catch (err) {
            console.error(err);
            setMessage("Error saving price.");
        } finally {
            setSaving(false);
        }
    }

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(q));
    }, [products, query]);

    if (loadingUser || loading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="space-y-6 text-white">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Pricing Manager</h1>
                    <p className="text-white/60 text-sm">Update product prices.</p>
                </div>
                <DripLink href="/sales-admin" className="text-sm underline opacity-70">Back</DripLink>
            </div>

            {message && <div className="bg-emerald-500/20 text-emerald-200 p-3 rounded-xl text-sm">{message}</div>}

            <div className={panelClass()}>
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-white/30"
                />
            </div>

            <div className="grid gap-4">
                {filtered.map((p) => {
                    // Calculate image URL
                    const imageUrl = p.imageUrl ? `${apiBase}${p.imageUrl}` : null;

                    return (
                        <div
                            key={p.id}
                            // Add 'gap-4' for spacing between image and text
                            className={panelClass() + " flex items-center justify-between gap-4"}
                        >
                            {/* LEFT SIDE: Image + Name/Price */}
                            <div className="flex items-center gap-4">
                                {/* IMAGE CONTAINER */}
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                    {imageUrl ? (
                                        <img
                                            src={imageUrl}
                                            alt={p.name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[8px] uppercase tracking-widest opacity-50">
                                            No IMG
                                        </div>
                                    )}
                                </div>

                                {/* TEXT CONTAINER */}
                                <div>
                                    <div className="font-medium">{p.name}</div>
                                    <div className="text-xs text-white/50">Current: ${p.price}</div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Edit Controls (No changes needed here) */}
                            {editingId === p.id ? (
                                <div className="flex items-center gap-2">
                                    {/* ... inputs and buttons ... */}
                                    <input
                                        type="number"
                                        className="w-24 rounded-lg border border-white/20 bg-black/30 px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-white/30"
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(e.target.value)}
                                    />
                                    <button
                                        onClick={() => handleSave(p)}
                                        disabled={saving}
                                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-white/90 disabled:opacity-50"
                                    >
                                        {saving ? "..." : "Save"}
                                    </button>
                                    <button
                                        onClick={() => setEditingId(null)}
                                        className="text-xs opacity-60 hover:opacity-100"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => startEdit(p)}
                                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5"
                                >
                                    Edit Price
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}