// ============================================
// MasterUz — Бэкапы базы: админ-API
// ============================================
// Статус и ручной запуск резервной копии. Только для администратора:
// дамп содержит всю базу, включая персональные данные пользователей.
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { auditService } from '../../services/auditService.js';
import { withLock } from '../../services/distributedLock.js';
import { getLastBackupAt } from '../../services/backupWatchdog.js';
import {
  runDatabaseBackup,
  isBackupConfigured,
  isPgDumpAvailable,
} from '../../services/databaseBackup.js';
import { config } from '../../config/index.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

/** Когда был последний бэкап и готова ли цепочка его снять. */
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const last = await getLastBackupAt();
    res.json({
      success: true,
      data: {
        enabled: config.backup.enabled,
        configured: isBackupConfigured(),
        pgDumpAvailable: isPgDumpAvailable(),
        lastBackupAt: last,
        ageHours: last ? Math.round((Date.now() - last.getTime()) / 3_600_000) : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Снять бэкап сейчас — например, перед рискованной миграцией. Та же
 * блокировка, что у расписания: два дампа одновременно не пойдут.
 */
router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await withLock('cron:db-backup', 30 * 60_000, runDatabaseBackup);
    if (!result) {
      res.status(409).json({ success: false, error: { message: 'Бэкап уже выполняется' } });
      return;
    }

    await auditService.log({
      actorId: req.user!.userId,
      action: 'DATABASE_BACKUP_RUN',
      entityType: 'Backup',
      entityId: result.key,
      details: { bytes: result.bytes, durationMs: result.durationMs, removedOld: result.removed.length } as any,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
