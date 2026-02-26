-- CreateTable: quiz_questions
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "question_uz" TEXT,
    "options" JSONB NOT NULL,
    "options_uz" JSONB,
    "correct_index" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- AlterTable: school_courses — add passing_score
ALTER TABLE "school_courses" ADD COLUMN IF NOT EXISTS "passing_score" INTEGER NOT NULL DEFAULT 70;

-- AlterTable: course_progress — add anti-skip fields
ALTER TABLE "course_progress" ADD COLUMN IF NOT EXISTS "video_watched_sec" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "course_progress" ADD COLUMN IF NOT EXISTS "video_completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "course_progress" ADD COLUMN IF NOT EXISTS "quiz_score" INTEGER;
ALTER TABLE "course_progress" ADD COLUMN IF NOT EXISTS "quiz_passed_at" TIMESTAMPTZ;
ALTER TABLE "course_progress" ADD COLUMN IF NOT EXISTS "quiz_attempts" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "school_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "quiz_questions_course_id_sort_order_idx" ON "quiz_questions"("course_id", "sort_order");
