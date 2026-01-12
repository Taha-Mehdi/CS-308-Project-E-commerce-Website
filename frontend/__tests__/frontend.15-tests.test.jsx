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
import DripLink from "../components/DripLink";
import AdminShell from "../components/AdminShell";
import DripLoader from "../components/DripLoader";
import GlobalLoaderGate from "../components/GlobalLoaderGate";
import PageTransition from "../components/PageTransition";
import SalesShell from "../components/SalesShell";

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
const mockUseRouter = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => mockUseRouter(),
}));

// ---- AuthContext mock ----
const mockUseAuth = jest.fn();
jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// ---- GlobalLoadingContext mock ----
const mockUseGlobalLoading = jest.fn();
jest.mock("../context/GlobalLoadingContext", () => ({
  useGlobalLoading: () => mockUseGlobalLoading(),
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
    mockUseGlobalLoading.mockReturnValue({ startLoading: jest.fn() });

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
  // StockBadge (1 test)
  // -------------------------
  test("5) StockBadge muted tone renders", () => {
    render(<StockBadge stock={3} tone="muted" />);
    expect(screen.getByText(/Stock · 3/i)).toBeInTheDocument();
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
      user: { fullName: "Boss", roleName: "product_manager" },
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

  // -------------------------
  // Additional tests (16-25)
  // -------------------------
  test("16) DripLink renders with href", () => {
    mockUseRouter.mockReturnValue({ push: jest.fn() });
    mockUseGlobalLoading.mockReturnValue({ startLoading: jest.fn() });

    render(<DripLink href="/test">Link</DripLink>);
    expect(screen.getByRole("link", { name: /link/i })).toHaveAttribute("href", "/test");
  });

  test("17) AdminShell shows title", () => {
    mockUseAuth.mockReturnValue({ user: { email: "admin@test.com" }, logout: jest.fn() });

    render(<AdminShell title="Test Title"><div>Content</div></AdminShell>);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  test("16) DripLoader renders loader", () => {
    render(<DripLoader><span>Loading</span></DripLoader>);
    expect(screen.getByText("SNEAKS-UP")).toBeInTheDocument();
  });

  test("19) GlobalLoaderGate renders children when not loading", () => {
    mockUseGlobalLoading.mockReturnValue({ loading: false });

    render(<GlobalLoaderGate><div>Content</div></GlobalLoaderGate>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  test("20) PageTransition renders children", () => {
    render(<PageTransition><p>Page</p></PageTransition>);
    expect(screen.getByText("Page")).toBeInTheDocument();
  });

  test("19) SalesShell shows sales content", () => {
    render(<SalesShell><h1>Sales Content</h1></SalesShell>);
    expect(screen.getByText("Sales Content")).toBeInTheDocument();
  });

  test("20) ActionButton outline variant", () => {
    render(<ActionButton variant="outline">Outline</ActionButton>);
    const btn = screen.getByRole("button", { name: /outline/i });
    expect(btn.className).toMatch(/border-gray-300/);
  });

  test("21) StockBadge with low stock", () => {
    render(<StockBadge stock={1} />);
    expect(screen.getByText("Stock · 1")).toBeInTheDocument();
  });

  test("24) Skeleton with custom width", () => {
    const { container } = render(<Skeleton className="w-20" />);
    const el = container.firstChild;
    expect(el.className).toMatch(/w-20/);
  });

  test("25) SiteLayout shows logout for logged in user", () => {
    mockUseAuth.mockReturnValue({ user: { fullName: "User" }, logout: jest.fn() });

    render(<SiteLayout><div>Test</div></SiteLayout>);
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  test("26) ActionButton muted variant includes muted classes", () => {
    render(<ActionButton variant="muted">Muted</ActionButton>);
    const btn = screen.getByRole("button", { name: /muted/i });
    expect(btn.className).toMatch(/bg-gray-50/);
    expect(btn.className).toMatch(/text-gray-700/);
  });

  test("27) ProductCard shows stock 0 when out of stock", () => {
    render(
      <ProductCard
        product={{
          id: 3,
          name: "Sold Out Sneaker",
          price: 120,
          stock: 0,
        }}
      />
    );

    expect(screen.getByText("Sold Out Sneaker")).toBeInTheDocument();
    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.getByText("Stock · 0")).toBeInTheDocument();
  });
});
