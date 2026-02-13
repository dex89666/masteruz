// ============================================
// MasterUz — School (Школа мастеров) Service
// Агент 5 (Контент-менеджер)
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';

export class SchoolService {
  /**
   * Получение списка курсов
   */
  async getCourses(categoryId?: string) {
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;

    return prisma.schoolCourse.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        category: { select: { name: true, nameUz: true, slug: true } },
        _count: { select: { progress: true } },
      },
    });
  }

  /**
   * Получение деталей курса
   */
  async getCourse(courseId: string) {
    const course = await prisma.schoolCourse.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        _count: { select: { progress: true } },
      },
    });

    if (!course) throw ApiError.notFound('Курс не найден');
    return course;
  }

  /**
   * Отметить курс как пройденный
   */
  async completeCourse(userId: string, courseId: string) {
    const course = await prisma.schoolCourse.findUnique({
      where: { id: courseId },
    });

    if (!course) throw ApiError.notFound('Курс не найден');

    const progress = await prisma.courseProgress.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
      },
      create: {
        userId,
        courseId,
        completed: true,
        completedAt: new Date(),
      },
    });

    // Проверяем, завершил ли мастер все обязательные курсы
    await this.checkSchoolCompletion(userId);

    return progress;
  }

  /**
   * Получение прогресса обучения
   */
  async getProgress(userId: string) {
    const [totalCourses, completedProgress, requiredCourses, completedRequired] = await Promise.all([
      prisma.schoolCourse.count({ where: { isActive: true } }),
      prisma.courseProgress.findMany({
        where: { userId, completed: true },
        include: { course: true },
      }),
      prisma.schoolCourse.count({ where: { isActive: true, isRequired: true } }),
      prisma.courseProgress.count({
        where: {
          userId,
          completed: true,
          course: { isRequired: true },
        },
      }),
    ]);

    return {
      totalCourses,
      completedCourses: completedProgress.length,
      requiredCourses,
      completedRequired,
      isSchoolCompleted: completedRequired >= requiredCourses,
      progress: completedProgress,
    };
  }

  /**
   * Проверка завершения обязательного обучения
   */
  private async checkSchoolCompletion(userId: string) {
    const requiredCourses = await prisma.schoolCourse.count({
      where: { isActive: true, isRequired: true },
    });

    const completedRequired = await prisma.courseProgress.count({
      where: {
        userId,
        completed: true,
        course: { isRequired: true },
      },
    });

    if (completedRequired >= requiredCourses) {
      await prisma.masterProfile.updateMany({
        where: { userId },
        data: { schoolCompleted: true },
      });
    }
  }
}

export const schoolService = new SchoolService();
