ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'rejected';

CREATE TYPE reservation_priority AS ENUM ('low', 'normal', 'high', 'urgent');

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS priority reservation_priority NOT NULL DEFAULT 'normal';
