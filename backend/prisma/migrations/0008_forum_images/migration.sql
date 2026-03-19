-- AlterTable: add images column to forum_topics
ALTER TABLE "forum_topics" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: add images column to forum_posts
ALTER TABLE "forum_posts" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
