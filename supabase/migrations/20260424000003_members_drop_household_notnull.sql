-- household_id is not used by the app — drop the NOT NULL constraint
ALTER TABLE members ALTER COLUMN household_id DROP NOT NULL;
