// ============================================
// MasterUz — Geo Routes
// Агент 4 (Специалист по геолокации)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { geoService } from './geo.service.js';
import { optionalAuth } from '../../middleware/auth.js';

const router = Router();

// Заказы поблизости
router.get('/orders-nearby', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude, radius, categoryId } = req.query;

    if (!latitude || !longitude) {
      res.status(400).json({
        success: false,
        error: { message: 'Укажите latitude и longitude' },
      });
      return;
    }

    const orders = await geoService.getOrdersNearby(
      parseFloat(latitude as string),
      parseFloat(longitude as string),
      radius ? parseFloat(radius as string) : 10,
      categoryId as string
    );

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// Мастера поблизости
router.get('/masters-nearby', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude, radius, specialization } = req.query;

    if (!latitude || !longitude) {
      res.status(400).json({
        success: false,
        error: { message: 'Укажите latitude и longitude' },
      });
      return;
    }

    const masters = await geoService.getMastersNearby(
      parseFloat(latitude as string),
      parseFloat(longitude as string),
      radius ? parseFloat(radius as string) : 10,
      specialization as string
    );

    res.json({ success: true, data: masters });
  } catch (error) {
    next(error);
  }
});

export default router;
