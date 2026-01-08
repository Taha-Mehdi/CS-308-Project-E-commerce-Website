CREATE TABLE IF NOT EXISTS "return_requests" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL REFERENCES "orders"("id"),
  "order_item_id" INTEGER NOT NULL REFERENCES "order_items"("id"),
  "customer_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "status" TEXT NOT NULL DEFAULT 'requested',
  "reason" TEXT,
  "requested_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "decided_by" INTEGER REFERENCES "users"("id"),
  "decided_at" TIMESTAMPTZ,
  "decision_note" TEXT,
  "received_at" TIMESTAMPTZ,
  "refunded_at" TIMESTAMPTZ,
  "refund_amount" NUMERIC(10,2)
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_return_request_order_item"
ON "return_requests"("order_item_id");
