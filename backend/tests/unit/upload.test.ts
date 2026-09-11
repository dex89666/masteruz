// ============================================
// MasterUz — Приём загружаемых файлов
// ============================================
// В продакшене multer писал принятый файл в том Railway (/app/uploads),
// смонтированный от root, а процесс работает от пользователя masteruz —
// каждая загрузка падала с EACCES. В режиме s3 файл на диске нужен лишь
// на миг перед заливкой в облако, поэтому принимать его надо во временный
// каталог ОС.

import { describe, it, expect, vi } from 'vitest';
import os from 'os';
import path from 'path';

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { resolveReceiveDir } from '../../src/middleware/upload.js';
import { config } from '../../src/config/index.js';

describe('каталог приёма файлов', () => {
  it('в режиме s3 — временный каталог ОС, а не том с загрузками', () => {
    const dir = resolveReceiveDir('s3');
    expect(dir.startsWith(os.tmpdir())).toBe(true);
    expect(dir).not.toBe(path.resolve(config.upload.dir));
  });

  it('в локальном режиме — постоянный каталог загрузок', () => {
    // Здесь файл и есть конечное хранилище: временная папка его бы потеряла.
    expect(resolveReceiveDir('local')).toBe(path.resolve(config.upload.dir));
  });
});
