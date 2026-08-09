-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "deviceToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Answer_questionId_deviceToken_key" ON "Answer"("questionId", "deviceToken");

