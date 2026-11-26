-- A councillor records their ward number (e.g. "3") alongside the postal codes
-- it covers, so the admin and the councillor can see which ward they represent.
ALTER TABLE ward_councillors ADD COLUMN IF NOT EXISTS ward TEXT;
