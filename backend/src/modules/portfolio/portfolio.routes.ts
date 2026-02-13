// ============================================
// MasterUz — Portfolio Routes
// REST API для портфолио мастера
// ============================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as portfolioService from './portfolio.service';

const router = Router();

// ─── Валидация ────────────────────────────────
const createSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url(),
  categoryId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ─── GET /portfolio/master/:masterId — публичное портфолио мастера ──
router.get('/master/:masterId', async (req: Request, res: Response) => {
  try {
    const { masterId } = req.params;
    const categoryId = req.query.categoryId as string | undefined;
    const items = await portfolioService.getMasterPortfolio(masterId, categoryId);

    res.json({
      success: true,
      data: items,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, statusCode: 500 },
    });
  }
});

// ─── GET /portfolio/stats — статистика моего портфолио ──
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized', statusCode: 401 } });

    const stats = await portfolioService.getPortfolioStats(userId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, statusCode: 500 },
    });
  }
});

// ─── GET /portfolio/:id — один элемент ────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await portfolioService.getPortfolioItem(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: { message: 'Portfolio item not found', statusCode: 404 },
      });
    }
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, statusCode: 500 },
    });
  }
});

// ─── POST /portfolio — создать элемент (мастер) ──
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    if (!userId || userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only masters can manage portfolio', statusCode: 403 },
      });
    }

    const parsed = createSchema.parse(req.body);
    const item = await portfolioService.createPortfolioItem(userId, parsed);

    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation error', statusCode: 400, details: error.errors },
      });
    }
    res.status(500).json({
      success: false,
      error: { message: error.message, statusCode: 500 },
    });
  }
});

// ─── PUT /portfolio/:id — обновить элемент ────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    if (!userId || userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only masters can manage portfolio', statusCode: 403 },
      });
    }

    const parsed = updateSchema.parse(req.body);
    const item = await portfolioService.updatePortfolioItem(req.params.id, userId, parsed);

    res.json({ success: true, data: item });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: { message: error.message, statusCode: 404 },
      });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation error', statusCode: 400, details: error.errors },
      });
    }
    res.status(500).json({
      success: false,
      error: { message: error.message, statusCode: 500 },
    });
  }
});

// ─── DELETE /portfolio/:id — удалить элемент ──
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    if (!userId || userRole !== 'MASTER') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only masters can manage portfolio', statusCode: 403 },
      });
    }

    await portfolioService.deletePortfolioItem(req.params.id, userId);
    res.json({ success: true, data: { message: 'Deleted' } });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: { message: error.message, statusCode: 404 },
      });
    }
    res.status(500).json({
      success: false,
      error: { message: error.message, statusCode: 500 },
    });
  }
});

export default router;
