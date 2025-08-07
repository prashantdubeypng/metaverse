/*
  Warnings:

  - Added the required column `thumbnail` to the `Map` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Map" ADD COLUMN     "thumbnail" TEXT NOT NULL;
