import { render, screen } from "@testing-library/react";
import StockBadge, { formatStockLabel } from "../components/StockBadge";

describe("StockBadge", () => {
  it("formats in-stock counts consistently", () => {
    expect(formatStockLabel(5)).toBe("In stock: 5");
  });

  it("formats zero or below as out of stock", () => {
    expect(formatStockLabel(0)).toBe("Out of stock");
    expect(formatStockLabel(-2)).toBe("Out of stock");
  });

  it("renders the badge text", () => {
    render(<StockBadge stock={5} />);
    expect(screen.getByText("In stock: 5")).toBeInTheDocument();
  });
});
