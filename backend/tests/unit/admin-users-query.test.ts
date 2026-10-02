import { describe, it, expect } from 'vitest';
import { adminUsersQuerySchema } from '../../src/modules/admin/admin.schema.js';

describe('adminUsersQuerySchema: булевы фильтры из query-строки', () => {
  it('"false" остаётся false (раньше z.coerce.boolean давал true)', () => {
    expect(adminUsersQuerySchema.parse({ isVerified: 'false' }).isVerified).toBe(false);
    expect(adminUsersQuerySchema.parse({ isActive: 'false' }).isActive).toBe(false);
  });

  it('"true" → true, отсутствие или пустая строка → без фильтра', () => {
    expect(adminUsersQuerySchema.parse({ isVerified: 'true' }).isVerified).toBe(true);
    expect(adminUsersQuerySchema.parse({}).isVerified).toBeUndefined();
    expect(adminUsersQuerySchema.parse({ isVerified: '' }).isVerified).toBeUndefined();
  });
});
