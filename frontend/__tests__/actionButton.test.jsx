import { render, screen } from "@testing-library/react";
import ActionButton, { getVariantClass } from "../components/ActionButton";

describe("ActionButton", () => {
  it("exposes consistent sizing classes", () => {
    render(<ActionButton>Click me</ActionButton>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn.className).toMatch(/text-\[11px\]/);
    expect(btn.className).toMatch(/rounded-full/);
  });

  it("returns success variant class for paid-like actions", () => {
    expect(getVariantClass("success")).toMatch(/emerald/);
  });
});
