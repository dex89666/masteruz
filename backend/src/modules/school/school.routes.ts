// ============================================
// MasterUz — School Routes
// Полная версия: публичные + анти-скип + квиз + админ CRUD
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { schoolService } from './school.service.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';

const router = Router();

// ═══════════════════════════════════════════
// PUBLIC: Курсы
// ═══════════════════════════════════════════

// Список курсов (публичный)
router.get('/courses', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await schoolService.getCourses(req.query.categoryId as string);
    res.json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
});

// Детали курса (с вопросами без правильных ответов)
router.get('/courses/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await schoolService.getCourse(req.params.id);
    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════
// USER: Прогресс + завершение
// ═══════════════════════════════════════════

// Прогресс обучения
router.get('/progress', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const progress = await schoolService.getProgress(req.user!.userId);
    res.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

// Обновить прогресс просмотра видео (анти-скип)
router.post('/courses/:id/video-progress', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { watchedSeconds } = req.body;
    const result = await schoolService.updateVideoProgress(req.user!.userId, req.params.id, watchedSeconds);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Отправить ответы квиза
router.post('/courses/:id/quiz', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { answers } = req.body;
    const result = await schoolService.submitQuiz(req.user!.userId, req.params.id, answers);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Завершение курса (для курсов без квиза)
router.post('/courses/:id/complete', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const progress = await schoolService.completeCourse(req.user!.userId, req.params.id);
    res.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════
// ADMIN: CRUD курсов
// ═══════════════════════════════════════════

router.get('/admin/courses', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Доступ запрещён' });
    }
    const courses = await schoolService.adminGetCourses();
    res.json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/courses', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Доступ запрещён' });
    }
    const course = await schoolService.adminCreateCourse(req.body);
    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/courses/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Доступ запрещён' });
    }
    const course = await schoolService.adminUpdateCourse(req.params.id, req.body);
    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

router.delete('/admin/courses/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Доступ запрещён' });
    }
    const result = await schoolService.adminDeleteCourse(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════
// ADMIN: CRUD вопросов квиза
// ═══════════════════════════════════════════

router.get('/admin/courses/:id/questions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Доступ запрещён' });
    }
    const questions = await schoolService.adminGetQuestions(req.params.id);
    res.json({ success: true, data: questions });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/courses/:id/questions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Доступ запрещён' });
    }
    const question = await schoolService.adminCreateQuestion(req.params.id, req.body);
    res.json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/questions/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Доступ запрещён' });
    }
    const question = await schoolService.adminUpdateQuestion(req.params.id, req.body);
    res.json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.delete('/admin/questions/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Доступ запрещён' });
    }
    const result = await schoolService.adminDeleteQuestion(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
