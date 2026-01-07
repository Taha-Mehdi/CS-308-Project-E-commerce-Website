-- Make review comment moderation spec-compliant:
-- status: none | pending | approved | rejected
-- plus moderation metadata

ALTER TABLE reviews
  ALTER COLUMN status SET DEFAULT 'none';

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS moderated_by integer REFERENCES users(id);

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Backfill older data:
-- If there is no comment, treat as "none" (rating-only).
UPDATE reviews
SET status = 'none'
WHERE (comment IS NULL OR btrim(comment) = '')
  AND status IN ('approved', 'pending', 'rejected');

-- If there is a comment and it was previously "approved" (old default), keep it.
-- If there is a comment and status is null/empty, set to pending (safer).
UPDATE reviews
SET status = 'pending'
WHERE comment IS NOT NULL
  AND btrim(comment) <> ''
  AND (status IS NULL OR btrim(status) = '');
