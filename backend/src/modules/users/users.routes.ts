// ============================================
// MasterUz — Users Routes
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { Router } from 'express';
import { usersController } from './users.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import {
  updateProfileSchema,
  createMasterProfileSchema,
  updateMasterProfileSchema,
  updateMasterCategoriesSchema,
} from './users.schema.js';

const router = Router();

// Публичные маршруты (без авторизации)
router.get('/masters/search', (req, res, next) => usersController.searchMasters(req, res, next));
router.get('/master/:id', (req, res, next) => usersController.getMasterById(req, res, next));

// Все маршруты ниже требуют авторизации
router.use(authenticate);

// Профиль
router.get('/profile', (req, res, next) => usersController.getProfile(req, res, next));
router.put('/profile', validateBody(updateProfileSchema), (req, res, next) =>
  usersController.updateProfile(req, res, next)
);

// Профиль мастера
router.post('/master-profile', validateBody(createMasterProfileSchema), (req, res, next) =>
  usersController.createMasterProfile(req, res, next)
);
router.put('/master-profile', validateBody(updateMasterProfileSchema), (req, res, next) =>
  usersController.updateMasterProfile(req, res, next)
);

// Категории мастера
router.get('/master-categories', (req, res, next) =>
  usersController.getMasterCategories(req, res, next)
);
router.put('/master-categories', validateBody(updateMasterCategoriesSchema), (req, res, next) =>
  usersController.updateMasterCategories(req, res, next)
);

// Сертификаты
router.post('/certificates', upload.single('file'), (req, res, next) =>
  usersController.uploadCertificate(req, res, next)
);

export default router;
