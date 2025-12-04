import { render, screen } from "@testing-library/react";
import ProductCard from "../components/ProductCard";

const baseProduct = {
  id: 1,
  name: "Test Sneaker",
  price: "99.99",
  stock: 7,
  imageUrl: null,
};

describe("ProductCard", () => {
  it("shows a consistent stock label from StockBadge", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText(/In stock: 7/i)).toBeInTheDocument();
  });
});
