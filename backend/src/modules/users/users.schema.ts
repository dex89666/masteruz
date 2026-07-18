// ============================================
// MasterUz — Users Validation Schemas
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().regex(/^\+998\d{9}$/, 'Формат: +998XXXXXXXXX').optional(),
  email: z.string().email().optional(),
  bio: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
});

export const createMasterProfileSchema = z.object({
  specializations: z.array(z.string()).min(1, 'Укажите хотя бы одну специализацию'),
  experienceYears: z.number().min(0).max(50).optional(),
  maxDistanceKm: z.number().min(1).max(500).default(10),
  hourlyRate: z.number().min(0).optional(),
  categoryIds: z.array(z.string().uuid()).min(1, 'Выберите хотя бы одну категорию услуг').optional(),
});

export const updateMasterProfileSchema = z.object({
  specializations: z.array(z.string()).optional(),
  experienceYears: z.number().min(0).max(50).optional(),
  isAvailable: z.boolean().optional(),
  maxDistanceKm: z.number().min(1).max(500).optional(),
  hourlyRate: z.number().min(0).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

export const updateMasterCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1, 'Выберите хотя бы одну категорию услуг'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateMasterProfileInput = z.infer<typeof createMasterProfileSchema>;
export type UpdateMasterProfileInput = z.infer<typeof updateMasterProfileSchema>;
export type UpdateMasterCategoriesInput = z.infer<typeof updateMasterCategoriesSchema>;

// Язык интерфейса и уведомлений
export const updateLanguageSchema = z.object({
  language: z.enum(['ru', 'uz', 'en']),
});
