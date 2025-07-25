-- Add display_name column and unique constraint
ALTER TABLE "User" ADD COLUMN "display_name" TEXT;
CREATE UNIQUE INDEX "User_display_name_key" ON "User"("display_name");
