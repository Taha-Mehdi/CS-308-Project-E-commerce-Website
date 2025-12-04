import {
  addReview,
  getReviewsByProduct,
  updateReviewStatus,
} from "../lib/reviews";

describe("reviews storage", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("adds and approves a review", () => {
    const created = addReview({
      productId: 10,
      rating: 4,
      comment: "Great shoe",
      userEmail: "test@example.com",
      productName: "Demo",
    });
    expect(getReviewsByProduct(10).length).toBe(1);
    updateReviewStatus(created.id, "approved");
    const approved = getReviewsByProduct(10)[0];
    expect(approved.status).toBe("approved");
  });
});
