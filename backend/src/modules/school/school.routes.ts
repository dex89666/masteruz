// ============================================
// MasterUz — School Routes
// Агент 5 (Контент-менеджер)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { schoolService } from './school.service.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';

const router = Router();

// Список курсов (публичный)
router.get('/courses', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await schoolService.getCourses(req.query.categoryId as string);
    res.json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
});

// Детали курса
router.get('/courses/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await schoolService.getCourse(req.params.id);
    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

// Завершение курса
router.post('/courses/:id/complete', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const progress = await schoolService.completeCourse(req.user!.userId, req.params.id);
    res.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

// Прогресс обучения
router.get('/progress', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const progress = await schoolService.getProgress(req.user!.userId);
    res.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
});

export default router;
