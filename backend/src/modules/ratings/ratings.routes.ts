// ============================================
// MasterUz — Ratings Routes
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { ratingsService } from './ratings.service.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Создание отзыва
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const review = await ratingsService.createReview(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
});

// Отзывы мастера
router.get('/master/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await ratingsService.getMasterReviews(req.params.id, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
