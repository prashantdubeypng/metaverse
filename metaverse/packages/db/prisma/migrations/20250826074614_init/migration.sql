/*
  Warnings:

  - You are about to drop the column `isPrivate` on the `Chatroom` table. All the data in the column will be lost.
  - You are about to drop the column `invitedBy` on the `ChatroomMember` table. All the data in the column will be lost.
  - You are about to drop the column `joinedAt` on the `ChatroomMember` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `ChatroomMember` table. All the data in the column will be lost.
  - You are about to drop the column `replyToId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `SpaceMember` table. All the data in the column will be lost.
  - You are about to drop the `ChatroomJoinRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Invitation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JoinRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MessageReaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserPresence` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `passcode` to the `Chatroom` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."ChatroomJoinRequest" DROP CONSTRAINT "ChatroomJoinRequest_chatroomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ChatroomJoinRequest" DROP CONSTRAINT "ChatroomJoinRequest_respondedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."ChatroomJoinRequest" DROP CONSTRAINT "ChatroomJoinRequest_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Invitation" DROP CONSTRAINT "Invitation_chatroomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Invitation" DROP CONSTRAINT "Invitation_invitedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."Invitation" DROP CONSTRAINT "Invitation_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."JoinRequest" DROP CONSTRAINT "JoinRequest_chatroomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."JoinRequest" DROP CONSTRAINT "JoinRequest_processedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."JoinRequest" DROP CONSTRAINT "JoinRequest_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_replyToId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MessageReaction" DROP CONSTRAINT "MessageReaction_messageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MessageReaction" DROP CONSTRAINT "MessageReaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserPresence" DROP CONSTRAINT "UserPresence_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Chatroom" DROP COLUMN "isPrivate",
ADD COLUMN     "passcode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."ChatroomMember" DROP COLUMN "invitedBy",
DROP COLUMN "joinedAt",
DROP COLUMN "role";

-- AlterTable
ALTER TABLE "public"."Message" DROP COLUMN "replyToId";

-- AlterTable
ALTER TABLE "public"."SpaceMember" DROP COLUMN "role";

-- DropTable
DROP TABLE "public"."ChatroomJoinRequest";

-- DropTable
DROP TABLE "public"."Invitation";

-- DropTable
DROP TABLE "public"."JoinRequest";

-- DropTable
DROP TABLE "public"."MessageReaction";

-- DropTable
DROP TABLE "public"."UserPresence";

-- DropEnum
DROP TYPE "public"."InviteStatus";

-- DropEnum
DROP TYPE "public"."MemberRole";

-- DropEnum
DROP TYPE "public"."RequestStatus";

-- DropEnum
DROP TYPE "public"."SpaceMemberRole";
