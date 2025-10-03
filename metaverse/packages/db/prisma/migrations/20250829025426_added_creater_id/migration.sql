/*
  Warnings:

  - Added the required column `createrId` to the `Map` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Map" ADD COLUMN     "createrId" TEXT NOT NULL;
