ALTER TABLE "return_requests"
  ADD COLUMN IF NOT EXISTS "refund_method" TEXT,
  ADD COLUMN IF NOT EXISTS "refund_reference" TEXT;

CREATE INDEX IF NOT EXISTS "idx_return_requests_customer"
ON "return_requests"("customer_id");

CREATE INDEX IF NOT EXISTS "idx_return_requests_status"
ON "return_requests"("status");

CREATE INDEX IF NOT EXISTS "idx_return_requests_order"
ON "return_requests"("order_id");
