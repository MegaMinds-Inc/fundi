-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "pin_hash" TEXT,
ADD COLUMN     "pin_salt" TEXT;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "family_expires_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "app" "AppClient" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "pin_attempts" INTEGER NOT NULL DEFAULT 0,
    "pin_locked_until" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_token_hash_key" ON "trusted_devices"("token_hash");

-- CreateIndex
CREATE INDEX "trusted_devices_account_id_app_idx" ON "trusted_devices"("account_id", "app");

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

