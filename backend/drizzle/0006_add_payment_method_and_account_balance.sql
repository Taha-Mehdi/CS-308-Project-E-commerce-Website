ALTER TABLE users
ADD COLUMN IF NOT EXISTS account_balance numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'credit_card';

ALTER TABLE return_requests
ADD COLUMN IF NOT EXISTS refund_method text;

ALTER TABLE return_requests
ADD COLUMN IF NOT EXISTS refund_reference text;
