-- 1) Ensure status column exists and is sane
ALTER TABLE reviews
  ALTER COLUMN status SET DEFAULT 'approved';

-- 2) Remove accidental duplicates (keep newest)
DELETE FROM reviews a
USING reviews b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.product_id = b.product_id;

-- 3) Enforce one review (rating) per user per product
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_product_unique
ON reviews (user_id, product_id);
