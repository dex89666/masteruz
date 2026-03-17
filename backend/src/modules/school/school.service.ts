// ============================================
// MasterUz — School (Школа мастеров) Service
// Полная версия с анти-скип, квиз, админ CRUD
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';

export class SchoolService {
  // ═════════════════════════════════════════
  // PUBLIC: Курсы
  // ═════════════════════════════════════════

  async getCourses(categoryId?: string) {
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;

    return prisma.schoolCourse.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        category: { select: { id: true, name: true, nameUz: true, slug: true } },
        _count: { select: { progress: true, questions: true } },
      },
    });
  }

  async getCourse(courseId: string) {
    const course = await prisma.schoolCourse.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        questions: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            question: true,
            questionUz: true,
            options: true,
            optionsUz: true,
            sortOrder: true,
          },
        },
        _count: { select: { progress: true } },
      },
    });

    if (!course) throw ApiError.notFound('Курс не найден');
    return course;
  }

  // ═════════════════════════════════════════
  // ANTI-SKIP: Отслеживание просмотра видео
  // ═════════════════════════════════════════

  async updateVideoProgress(userId: string, courseId: string, watchedSeconds: number) {
    const course = await prisma.schoolCourse.findUnique({ where: { id: courseId } });
    if (!course) throw ApiError.notFound('Курс не найден');

    const durationSec = (course.durationMinutes || 1) * 60;
    const videoCompleted = watchedSeconds >= durationSec * 0.8;

    const progress = await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {
        videoWatchedSec: Math.max(watchedSeconds, 0),
        videoCompleted,
      },
      create: {
        userId,
        courseId,
        videoWatchedSec: Math.max(watchedSeconds, 0),
        videoCompleted,
      },
    });

    return {
      videoWatchedSec: progress.videoWatchedSec,
      videoCompleted: progress.videoCompleted,
      requiredSec: Math.floor(durationSec * 0.8),
    };
  }

  // ═════════════════════════════════════════
  // QUIZ: Проверочный тест
  // ═════════════════════════════════════════

  async submitQuiz(userId: string, courseId: string, answers: number[]) {
    const course = await prisma.schoolCourse.findUnique({
      where: { id: courseId },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!course) throw ApiError.notFound('Курс не найден');
    if (course.questions.length === 0) {
      throw ApiError.badRequest('У этого курса нет вопросов для теста');
    }

    if (course.videoUrl) {
      const existing = await prisma.courseProgress.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (!existing?.videoCompleted) {
        throw ApiError.badRequest('Сначала посмотрите видеоурок полностью (не менее 80%)');
      }
    }

    let correct = 0;
    const totalQuestions = course.questions.length;
    for (let i = 0; i < totalQuestions; i++) {
      if (answers[i] !== undefined && answers[i] === course.questions[i].correctIndex) {
        correct++;
      }
    }

    const score = Math.round((correct / totalQuestions) * 100);
    const passed = score >= (course.passingScore || 70);

    const progress = await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {
        quizScore: score,
        quizAttempts: { increment: 1 },
        ...(passed ? { quizPassedAt: new Date(), completed: true, completedAt: new Date() } : {}),
      },
      create: {
        userId,
        courseId,
        quizScore: score,
        quizAttempts: 1,
        ...(passed ? { quizPassedAt: new Date(), completed: true, completedAt: new Date() } : {}),
      },
    });

    if (passed) await this.checkSchoolCompletion(userId);

    return {
      score,
      passed,
      correctCount: correct,
      totalQuestions,
      passingScore: course.passingScore || 70,
      attempts: progress.quizAttempts,
    };
  }

  async completeCourse(userId: string, courseId: string) {
    const course = await prisma.schoolCourse.findUnique({
      where: { id: courseId },
      include: { _count: { select: { questions: true } } },
    });

    if (!course) throw ApiError.notFound('Курс не найден');

    if (course._count.questions > 0) {
      throw ApiError.badRequest('Для завершения курса необходимо пройти тест');
    }

    if (course.videoUrl) {
      const existing = await prisma.courseProgress.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (!existing?.videoCompleted) {
        throw ApiError.badRequest('Сначала посмотрите видеоурок полностью');
      }
    }

    const progress = await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { completed: true, completedAt: new Date() },
      create: { userId, courseId, completed: true, completedAt: new Date() },
    });

    await this.checkSchoolCompletion(userId);
    return progress;
  }

  // ═════════════════════════════════════════
  // PROGRESS
  // ═════════════════════════════════════════

  async getProgress(userId: string) {
    const [totalCourses, allProgress, requiredCourses, completedRequired] = await Promise.all([
      prisma.schoolCourse.count({ where: { isActive: true } }),
      prisma.courseProgress.findMany({
        where: { userId },
        include: { course: { include: { _count: { select: { questions: true } } } } },
      }),
      prisma.schoolCourse.count({ where: { isActive: true, isRequired: true } }),
      prisma.courseProgress.count({
        where: { userId, completed: true, course: { isRequired: true } },
      }),
    ]);

    return {
      totalCourses,
      completedCourses: allProgress.filter(p => p.completed).length,
      requiredCourses,
      completedRequired,
      isSchoolCompleted: requiredCourses > 0 && completedRequired >= requiredCourses,
      progress: allProgress,
    };
  }

  // ═════════════════════════════════════════
  // ADMIN: CRUD курсов
  // ═════════════════════════════════════════

  async adminGetCourses() {
    return prisma.schoolCourse.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        category: { select: { id: true, name: true, nameUz: true } },
        _count: { select: { progress: true, questions: true } },
      },
    });
  }

  async adminCreateCourse(data: {
    title: string;
    titleUz?: string;
    description?: string;
    descriptionUz?: string;
    content?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    durationMinutes?: number;
    categoryId?: string;
    isRequired?: boolean;
    isActive?: boolean;
    passingScore?: number;
    sortOrder?: number;
  }) {
    return prisma.schoolCourse.create({
      data: {
        title: data.title,
        titleUz: data.titleUz,
        description: data.description,
        descriptionUz: data.descriptionUz,
        content: data.content,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        durationMinutes: data.durationMinutes,
        categoryId: data.categoryId || null,
        isRequired: data.isRequired ?? false,
        isActive: data.isActive ?? true,
        passingScore: data.passingScore ?? 70,
        sortOrder: data.sortOrder ?? 0,
      },
      include: {
        category: { select: { id: true, name: true, nameUz: true } },
        _count: { select: { progress: true, questions: true } },
      },
    });
  }

  async adminUpdateCourse(courseId: string, data: any) {
    const course = await prisma.schoolCourse.findUnique({ where: { id: courseId } });
    if (!course) throw ApiError.notFound('Курс не найден');

    return prisma.schoolCourse.update({
      where: { id: courseId },
      data,
      include: {
        category: { select: { id: true, name: true, nameUz: true } },
        _count: { select: { progress: true, questions: true } },
      },
    });
  }

  async adminDeleteCourse(courseId: string) {
    const course = await prisma.schoolCourse.findUnique({ where: { id: courseId } });
    if (!course) throw ApiError.notFound('Курс не найден');
    await prisma.schoolCourse.delete({ where: { id: courseId } });
    return { deleted: true };
  }

  // ═════════════════════════════════════════
  // ADMIN: CRUD вопросов квиза
  // ═════════════════════════════════════════

  async adminGetQuestions(courseId: string) {
    return prisma.quizQuestion.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async adminCreateQuestion(courseId: string, data: {
    question: string;
    questionUz?: string;
    options: string[];
    optionsUz?: string[];
    correctIndex: number;
    sortOrder?: number;
  }) {
    const course = await prisma.schoolCourse.findUnique({ where: { id: courseId } });
    if (!course) throw ApiError.notFound('Курс не найден');

    if (data.correctIndex < 0 || data.correctIndex >= data.options.length) {
      throw ApiError.badRequest('Неверный индекс правильного ответа');
    }

    return prisma.quizQuestion.create({
      data: {
        courseId,
        question: data.question,
        questionUz: data.questionUz,
        options: data.options,
        optionsUz: data.optionsUz,
        correctIndex: data.correctIndex,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async adminUpdateQuestion(questionId: string, data: any) {
    const q = await prisma.quizQuestion.findUnique({ where: { id: questionId } });
    if (!q) throw ApiError.notFound('Вопрос не найден');
    return prisma.quizQuestion.update({ where: { id: questionId }, data });
  }

  async adminDeleteQuestion(questionId: string) {
    const q = await prisma.quizQuestion.findUnique({ where: { id: questionId } });
    if (!q) throw ApiError.notFound('Вопрос не найден');
    await prisma.quizQuestion.delete({ where: { id: questionId } });
    return { deleted: true };
  }

  // ═════════════════════════════════════════
  // PRIVATE
  // ═════════════════════════════════════════

  private async checkSchoolCompletion(userId: string) {
    const requiredCourses = await prisma.schoolCourse.count({
      where: { isActive: true, isRequired: true },
    });

    const completedRequired = await prisma.courseProgress.count({
      where: { userId, completed: true, course: { isRequired: true } },
    });

    if (completedRequired >= requiredCourses && requiredCourses > 0) {
      await prisma.masterProfile.updateMany({
        where: { userId },
        data: { schoolCompleted: true },
      });
    }
  }
}

export const schoolService = new SchoolService();
