import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { moderateMessage, censorMessage } from '../chat/chatModeration.js';
import { logger } from '../../utils/logger.js';
import { upload, saveUploadedFile } from '../../middleware/upload.js';
import { z } from 'zod';

const router = Router();

const forumPaginationSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(50).default(20),
});

// Все маршруты требуют авторизации и роли MASTER (или ADMIN)
router.use(authenticate);

// ─── Список тем (GET /api/forum/topics) ───
router.get('/topics', validateQuery(forumPaginationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page as unknown as number;
    const limit = req.query.limit as unknown as number;
    const skip = (page - 1) * limit;

    const [topics, total] = await Promise.all([
      prisma.forumTopic.findMany({
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          author: { include: { profile: true } },
          _count: { select: { posts: true } },
        },
      }),
      prisma.forumTopic.count(),
    ]);

    res.json({
      success: true,
      data: topics,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Тема + посты (GET /api/forum/topics/:id) ───
router.get('/topics/:id', validateQuery(forumPaginationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const page = req.query.page as unknown as number;
    const limit = req.query.limit as unknown as number;
    const skip = (page - 1) * limit;

    const topic = await prisma.forumTopic.findUnique({
      where: { id },
      include: {
        author: { include: { profile: true } },
      },
    });
    if (!topic) throw ApiError.notFound('Тема не найдена');

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: { topicId: id },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          author: { include: { profile: true } },
        },
      }),
      prisma.forumPost.count({ where: { topicId: id } }),
    ]);

    res.json({
      success: true,
      data: { ...topic, posts },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Создать тему (POST /api/forum/topics) — только мастера ───
router.post('/topics', upload.array('images', 5), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { title, content } = req.body;

    if (!title || !content) {
      throw ApiError.badRequest('Заголовок и содержание обязательны');
    }
    if (title.length > 200) throw ApiError.badRequest('Заголовок слишком длинный');
    if (content.length > 5000) throw ApiError.badRequest('Содержание слишком длинное');

    // Проверяем роль
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || (user.role !== 'MASTER' && user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      throw ApiError.forbidden('Только мастера могут создавать темы');
    }

    // Модерация контента
    const titleMod = moderateMessage(title);
    const contentMod = moderateMessage(content);
    if (titleMod.isBlocked || contentMod.isBlocked) {
      logger.warn({ userId, titleViolation: titleMod.reasons, contentViolation: contentMod.reasons }, 'Форум: контент заблокирован');
      throw ApiError.badRequest('Сообщение содержит запрещённый контент');
    }

    // Загрузка изображений
    const imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const url = await saveUploadedFile(file);
        imageUrls.push(url);
      }
    }

    const topic = await prisma.forumTopic.create({
      data: {
        title: censorMessage(title),
        content: censorMessage(content),
        images: imageUrls,
        authorId: userId,
      },
      include: {
        author: { include: { profile: true } },
      },
    });

    res.status(201).json({ success: true, data: topic });
  } catch (error) {
    next(error);
  }
});

// ─── Ответ в теме (POST /api/forum/topics/:id/posts) — только мастера ───
router.post('/topics/:id/posts', upload.array('images', 5), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id: topicId } = req.params;
    const { content } = req.body;

    if (!content) throw ApiError.badRequest('Содержание обязательно');
    if (content.length > 3000) throw ApiError.badRequest('Сообщение слишком длинное');

    // Проверяем роль
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || (user.role !== 'MASTER' && user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      throw ApiError.forbidden('Только мастера могут писать в форуме');
    }

    // Проверяем что тема существует и не заблокирована
    const topic = await prisma.forumTopic.findUnique({ where: { id: topicId }, select: { isLocked: true } });
    if (!topic) throw ApiError.notFound('Тема не найдена');
    if (topic.isLocked) throw ApiError.badRequest('Тема заблокирована для новых сообщений');

    // Модерация
    const mod = moderateMessage(content);
    if (mod.isBlocked) {
      logger.warn({ userId, topicId, reason: mod.reasons }, 'Форум: пост заблокирован');
      throw ApiError.badRequest('Сообщение содержит запрещённый контент');
    }

    // Загрузка изображений
    const imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const url = await saveUploadedFile(file);
        imageUrls.push(url);
      }
    }

    const post = await prisma.forumPost.create({
      data: {
        content: censorMessage(content),
        images: imageUrls,
        authorId: userId,
        topicId,
      },
      include: {
        author: { include: { profile: true } },
      },
    });

    res.status(201).json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
});

// ─── Удалить тему (DELETE /api/forum/topics/:id) — автор или админ ───
router.delete('/topics/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const topic = await prisma.forumTopic.findUnique({ where: { id }, select: { authorId: true } });
    if (!topic) throw ApiError.notFound('Тема не найдена');

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    if (topic.authorId !== userId && !isAdmin) {
      throw ApiError.forbidden('Нет прав на удаление');
    }

    await prisma.forumTopic.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── Закрепить/заблокировать тему (PUT /api/forum/topics/:id/moderate) — админ ───
router.put('/topics/:id/moderate', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isPinned, isLocked } = req.body;

    const data: Record<string, boolean> = {};
    if (typeof isPinned === 'boolean') data.isPinned = isPinned;
    if (typeof isLocked === 'boolean') data.isLocked = isLocked;

    const topic = await prisma.forumTopic.update({ where: { id }, data });
    res.json({ success: true, data: topic });
  } catch (error) {
    next(error);
  }
});

export default router;
