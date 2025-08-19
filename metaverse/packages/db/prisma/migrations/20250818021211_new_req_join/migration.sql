-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."JoinRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatroomId" TEXT NOT NULL,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invitation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatroomId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "status" "public"."InviteStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JoinRequest_id_key" ON "public"."JoinRequest"("id");

-- CreateIndex
CREATE INDEX "JoinRequest_userId_idx" ON "public"."JoinRequest"("userId");

-- CreateIndex
CREATE INDEX "JoinRequest_chatroomId_idx" ON "public"."JoinRequest"("chatroomId");

-- CreateIndex
CREATE INDEX "JoinRequest_status_idx" ON "public"."JoinRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JoinRequest_userId_chatroomId_key" ON "public"."JoinRequest"("userId", "chatroomId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_id_key" ON "public"."Invitation"("id");

-- CreateIndex
CREATE INDEX "Invitation_userId_idx" ON "public"."Invitation"("userId");

-- CreateIndex
CREATE INDEX "Invitation_chatroomId_idx" ON "public"."Invitation"("chatroomId");

-- CreateIndex
CREATE INDEX "Invitation_invitedBy_idx" ON "public"."Invitation"("invitedBy");

-- CreateIndex
CREATE INDEX "Invitation_status_idx" ON "public"."Invitation"("status");

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_idx" ON "public"."Invitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_userId_chatroomId_key" ON "public"."Invitation"("userId", "chatroomId");

-- AddForeignKey
ALTER TABLE "public"."JoinRequest" ADD CONSTRAINT "JoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JoinRequest" ADD CONSTRAINT "JoinRequest_chatroomId_fkey" FOREIGN KEY ("chatroomId") REFERENCES "public"."Chatroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JoinRequest" ADD CONSTRAINT "JoinRequest_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_chatroomId_fkey" FOREIGN KEY ("chatroomId") REFERENCES "public"."Chatroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
