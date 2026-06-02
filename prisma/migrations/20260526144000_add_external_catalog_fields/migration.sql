ALTER TABLE "Practice"
  ADD COLUMN IF NOT EXISTS "catalogProviderLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "catalogApiBaseUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "catalogApiKeyMasked" TEXT;
