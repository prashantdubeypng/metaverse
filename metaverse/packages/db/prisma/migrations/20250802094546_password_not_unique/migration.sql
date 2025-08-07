/*
  Warnings:

  - Made the column `avatarId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_avatarId_fkey";

-- DropIndex
DROP INDEX "public"."User_password_key";

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "avatarId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "public"."Avatar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
