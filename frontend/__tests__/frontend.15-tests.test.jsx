/**
 * @jest-environment jsdom
 */

// IMPORTANT: try to set env early (SiteLayout reads it at module scope)
process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000";

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ActionButton, { getVariantClass } from "../components/ActionButton";
import ProductCard from "../components/ProductCard";
import StockBadge, { formatStockLabel } from "../components/StockBadge";
import SiteLayout from "../components/SiteLayout";
import Skeleton from "../components/Skeleton";

// ---- Next.js mocks ----
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockUsePathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

// ---- AuthContext mock ----
const mockUseAuth = jest.fn();
jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function setToken(token) {
  window.localStorage.setItem("token", token);
}

describe("Frontend 15-unit-test suite (components + layout)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();

    mockUsePathname.mockReturnValue("/");
    mockUseAuth.mockReturnValue({ user: null, logout: jest.fn() });

    global.fetch = jest.fn();
  });

  // -------------------------
  // ActionButton (4 tests)
  // -------------------------
  test("1) ActionButton renders children", () => {
    render(<ActionButton>Click me</ActionButton>);
    expect(
      screen.getByRole("button", { name: /click me/i })
    ).toBeInTheDocument();
  });

  test("2) ActionButton primary variant includes primary classes", () => {
    render(<ActionButton variant="primary">Buy</ActionButton>);
    const btn = screen.getByRole("button", { name: /buy/i });
    expect(btn.className).toMatch(/bg-black/);
    expect(btn.className).toMatch(/text-white/);
  });

  test("3) ActionButton invalid variant falls back to primary", () => {
    render(<ActionButton variant="not-real">X</ActionButton>);
    const btn = screen.getByRole("button", { name: /x/i });
    expect(btn.className).toMatch(/bg-black/);
  });

  test("4) getVariantClass returns correct class for danger", () => {
    const cls = getVariantClass("danger");
    expect(cls).toMatch(/bg-red-600/);
  });

  // -------------------------
  // StockBadge (3 tests)
  // -------------------------
  test("5) formatStockLabel returns 'Out of stock' for 0", () => {
    expect(formatStockLabel(0)).toBe("Out of stock");
  });

  test("6) formatStockLabel returns 'In stock: N' for positive stock", () => {
    expect(formatStockLabel(7)).toBe("In stock: 7");
  });

  test("7) StockBadge muted tone adds muted classes", () => {
    render(<StockBadge stock={3} tone="muted" />);
    const el = screen.getByText(/in stock: 3/i);
    expect(el.className).toMatch(/bg-gray-100/);
    expect(el.className).toMatch(/text-gray-700/);
  });

  // -------------------------
  // Skeleton (1 test)
  // -------------------------
  test("8) Skeleton includes animate-pulse and merges className", () => {
    const { container } = render(<Skeleton className="h-5 w-10" />);
    const el = container.firstChild;
    expect(el.className).toMatch(/animate-pulse/);
    expect(el.className).toMatch(/h-5/);
    expect(el.className).toMatch(/w-10/);
  });

  // -------------------------
  // ProductCard (3 tests)
  // -------------------------
  test("9) ProductCard shows placeholder text when no imageUrl", () => {
    render(
      <ProductCard
        product={{
          id: 1,
          name: "Air Zoom",
          price: 99.9,
          stock: 2,
        }}
      />
    );

    expect(screen.getByText(/sneaks-up/i)).toBeInTheDocument();
    expect(screen.getByText("Air Zoom")).toBeInTheDocument();
    expect(screen.getByText("$99.90")).toBeInTheDocument();
  });

  test("10) ProductCard renders image with API base url when imageUrl exists", () => {
    render(
      <ProductCard
        product={{
          id: 2,
          name: "Jordan",
          price: 150,
          stock: 5,
          imageUrl: "/uploads/x.avif",
        }}
      />
    );

    const img = screen.getByRole("img", { name: /jordan/i });
    // if env is set correctly, this is the full URL
    expect(img.getAttribute("src")).toMatch(/\/uploads\/x\.avif$/);
  });

  test("11) ProductCard link points to /products/:id", () => {
    render(
      <ProductCard
        product={{
          id: 42,
          name: "Dunk",
          price: 80,
          stock: 1,
        }}
      />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/products/42");
  });

  // -------------------------
  // SiteLayout (4 tests)
  // -------------------------
  test("12) SiteLayout shows Login + Get started when user is not logged in", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: jest.fn() });

    render(
      <SiteLayout>
        <div>Child</div>
      </SiteLayout>
    );

    expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /get started/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /logout/i })
    ).not.toBeInTheDocument();
  });

  test("13) SiteLayout shows Account name + Logout when user is logged in", () => {
    const logout = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { fullName: "Ada", roleId: 2 },
      logout,
    });

    render(
      <SiteLayout>
        <div>Child</div>
      </SiteLayout>
    );

    expect(screen.getByRole("link", { name: /ada/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  test("14) SiteLayout hides /admin for non-admin and shows /admin for admin", () => {
    // non-admin
    mockUseAuth.mockReturnValue({
      user: { fullName: "User", roleId: 2 },
      logout: jest.fn(),
    });

    const { rerender } = render(
      <SiteLayout>
        <div>Child</div>
      </SiteLayout>
    );

    const adminLinkNonAdmin = screen
      .queryAllByRole("link")
      .find((a) => a.getAttribute("href") === "/admin");
    expect(adminLinkNonAdmin).toBeUndefined();

    // admin
    mockUseAuth.mockReturnValue({
      user: { fullName: "Boss", roleId: 1 },
      logout: jest.fn(),
    });

    rerender(
      <SiteLayout>
        <div>Child</div>
      </SiteLayout>
    );

    const adminLinkAdmin = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === "/admin");
    expect(adminLinkAdmin).toBeTruthy();
  });

  test("15) SiteLayout shows cart badge count when token exists and /cart returns JSON array", async () => {
    mockUseAuth.mockReturnValue({
      user: { fullName: "X", roleId: 2 },
      logout: jest.fn(),
    });

    setToken("abc");

    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
    });

    render(
      <SiteLayout>
        <div>Child</div>
      </SiteLayout>
    );

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    // ✅ robust: don't assume apiBase is defined in Jest, only that it hits /cart
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];

    expect(String(url)).toMatch(/\/cart$/);
    expect(options).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer abc",
        }),
      })
    );
  });
});
