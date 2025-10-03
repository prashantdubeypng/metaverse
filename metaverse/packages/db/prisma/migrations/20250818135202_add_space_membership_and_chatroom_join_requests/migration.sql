-- CreateEnum
CREATE TYPE "public"."SpaceMemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "replyToId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'sent',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'text';

-- CreateTable
CREATE TABLE "public"."SpaceMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "role" "public"."SpaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatroomJoinRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatroomId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,

    CONSTRAINT "ChatroomJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserPresence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "customMessage" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpaceMember_id_key" ON "public"."SpaceMember"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceMember_userId_spaceId_key" ON "public"."SpaceMember"("userId", "spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatroomJoinRequest_id_key" ON "public"."ChatroomJoinRequest"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatroomJoinRequest_userId_chatroomId_key" ON "public"."ChatroomJoinRequest"("userId", "chatroomId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_id_key" ON "public"."MessageReaction"("id");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_idx" ON "public"."MessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "MessageReaction_userId_idx" ON "public"."MessageReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "public"."MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "UserPresence_id_key" ON "public"."UserPresence"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserPresence_userId_key" ON "public"."UserPresence"("userId");

-- CreateIndex
CREATE INDEX "UserPresence_status_idx" ON "public"."UserPresence"("status");

-- CreateIndex
CREATE INDEX "UserPresence_lastSeen_idx" ON "public"."UserPresence"("lastSeen");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "public"."Message"("status");

-- AddForeignKey
ALTER TABLE "public"."SpaceMember" ADD CONSTRAINT "SpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatroomJoinRequest" ADD CONSTRAINT "ChatroomJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatroomJoinRequest" ADD CONSTRAINT "ChatroomJoinRequest_chatroomId_fkey" FOREIGN KEY ("chatroomId") REFERENCES "public"."Chatroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatroomJoinRequest" ADD CONSTRAINT "ChatroomJoinRequest_respondedBy_fkey" FOREIGN KEY ("respondedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "public"."Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPresence" ADD CONSTRAINT "UserPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
