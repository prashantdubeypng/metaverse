-- CreateEnum
CREATE TYPE "public"."MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "public"."Chatroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "spaceId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chatroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatroomMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatroomId" TEXT NOT NULL,
    "role" "public"."MemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChatroomMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chatroom_id_key" ON "public"."Chatroom"("id");

-- CreateIndex
CREATE INDEX "Chatroom_spaceId_idx" ON "public"."Chatroom"("spaceId");

-- CreateIndex
CREATE INDEX "Chatroom_creatorId_idx" ON "public"."Chatroom"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatroomMember_id_key" ON "public"."ChatroomMember"("id");

-- CreateIndex
CREATE INDEX "ChatroomMember_userId_idx" ON "public"."ChatroomMember"("userId");

-- CreateIndex
CREATE INDEX "ChatroomMember_chatroomId_idx" ON "public"."ChatroomMember"("chatroomId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatroomMember_userId_chatroomId_key" ON "public"."ChatroomMember"("userId", "chatroomId");

-- AddForeignKey
ALTER TABLE "public"."Chatroom" ADD CONSTRAINT "Chatroom_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Chatroom" ADD CONSTRAINT "Chatroom_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatroomMember" ADD CONSTRAINT "ChatroomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatroomMember" ADD CONSTRAINT "ChatroomMember_chatroomId_fkey" FOREIGN KEY ("chatroomId") REFERENCES "public"."Chatroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
