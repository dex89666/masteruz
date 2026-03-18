import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

interface AuditLogEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
}

class AuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({ data: entry });
    } catch (error) {
      // Аудит-лог не должен ломать основную операцию
      logger.error({ error, entry }, 'Не удалось записать аудит-лог');
    }
  }

  async getByEntity(entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, username: true, role: true } } },
    });
  }

  async getByActor(actorId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const auditService = new AuditService();
