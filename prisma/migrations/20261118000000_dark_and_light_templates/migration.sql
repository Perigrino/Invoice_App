ALTER TABLE "Setting" ALTER COLUMN "template" SET DEFAULT 'light';

-- The five former designs all had light pages; Light is the closest survivor.
UPDATE "Setting" SET "template" = 'light' WHERE "template" NOT IN ('dark', 'light');
