// ============================================
// MasterUz — Users Controller
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service.js';
import { isSuperAdmin } from '../../utils/helpers.js';

export class UsersController {
  /**
   * GET /api/users/profile
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.getMasterProfile(req.user!.userId);

      // Добавляем isAdminUser для корректной работы переключения ролей на фронтенде
      let isAdminUser = user.role === 'ADMIN' || user.role === 'MANAGER' || isSuperAdmin(user.username);
      if (!isAdminUser) {
        try {
          const { prisma } = await import('../../config/database.js');
          const adminConfig = await prisma.platformConfig.findUnique({ where: { key: 'admin_user_ids' } });
          if (adminConfig) {
            const adminIds = adminConfig.value.split(',').map((s: string) => s.trim());
            isAdminUser = adminIds.includes(user.id);
          }
        } catch {}
      }

      res.json({ success: true, data: { ...user, telegramId: Number(user.telegramId), isAdminUser } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/users/profile
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await usersService.updateProfile(req.user!.userId, req.body);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/users/master-profile
   */
  async createMasterProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const masterProfile = await usersService.createMasterProfile(req.user!.userId, req.body);
      res.json({ success: true, data: masterProfile });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/users/master-profile
   */
  async updateMasterProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const masterProfile = await usersService.updateMasterProfile(req.user!.userId, req.body);
      res.json({ success: true, data: masterProfile });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/users/certificates
   */
  async uploadCertificate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: { message: 'Файл не загружен' } });
        return;
      }

      const certificate = await usersService.uploadCertificate(
        req.user!.userId,
        req.body.title || 'Сертификат',
        `/uploads/${file.filename}`
      );

      res.json({ success: true, data: certificate });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/master/:id
   */
  async getMasterById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const master = await usersService.getMasterProfile(req.params.id);
      res.json({ success: true, data: master });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/masters/search
   */
  async searchMasters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.searchMasters({
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        city: req.query.city as string | undefined,
        specialization: req.query.specialization as string | undefined,
        categoryId: req.query.categoryId as string | undefined,
        minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
        search: req.query.search as string | undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/users/master-categories — обновить категории мастера
   */
  async updateMasterCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.updateMasterCategories(req.user!.userId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/master-categories — получить категории мастера
   */
  async getMasterCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await usersService.getMasterCategories(req.user!.userId);
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/users/master-profile — удалить профиль мастера
   */
  async deleteMasterProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.deleteMasterProfile(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
