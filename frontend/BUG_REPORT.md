# Bug Report: Inconsistent Stock Number Display

## Title
Product stock numbers show different wording across pages

## Description
Stock counts for products were rendered differently on multiple pages (catalog cards, product details, and admin product cards). Some locations showed raw numbers (e.g., `Stock: 5`), while others displayed phrases such as `5 in stock`. This led to inconsistent UX and occasional confusion about availability.

## Steps to Reproduce
1. Start the frontend (`npm run dev`) and open the shop homepage.
2. Navigate to **Drops** and observe the stock text on product cards.
3. Open a product detail page and check the stock message under the price.
4. As an admin, open **Admin → Products** and view stock text in the list.

## Expected Behavior
Stock should use a single, consistent phrasing and derive from the same `product.stock` field everywhere.

## Actual Behavior (Before Fix)
- Catalog grid: `Stock: 5`
- Detail page: `5 in stock` or `Out of stock`
- Admin list: `Stock: 5`

## Fix Summary
Introduced a shared `StockBadge` component (and `formatStockLabel`) used across product listing, product detail, and admin product cards. The badge now shows a consistent label (`In stock: N` or `Out of stock`) sourced directly from `product.stock`.
