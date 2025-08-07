-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_avatarId_fkey";

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "avatarId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "public"."Avatar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
