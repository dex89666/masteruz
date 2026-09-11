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

import fs from 'fs';
import { EventEmitter } from 'events';
import { resolveReceiveDir, isMagicBytesValid, createUploadCleanup } from '../../src/middleware/upload.js';
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

describe('сигнатуры видео', () => {
  const mp4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f]);
  const html = Buffer.from('<html><script>');

  it('принимает настоящие MP4, MOV и WebM', () => {
    expect(isMagicBytesValid(mp4, 'video/mp4')).toBe(true);
    expect(isMagicBytesValid(mp4, 'video/quicktime')).toBe(true);
    expect(isMagicBytesValid(webm, 'video/webm')).toBe(true);
  });

  it('отклоняет файл, выдающий себя за видео', () => {
    expect(isMagicBytesValid(html, 'video/mp4')).toBe(false);
    expect(isMagicBytesValid(html, 'video/webm')).toBe(false);
    expect(isMagicBytesValid(mp4, 'video/webm')).toBe(false);
  });
});

describe('уборка временных файлов', () => {
  const tmpFile = () => {
    const p = path.join(os.tmpdir(), `masteruz-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.writeFileSync(p, 'x');
    return p;
  };
  const run = async (driver: string, statusCode: number, filePath: string) => {
    const res = Object.assign(new EventEmitter(), { statusCode });
    const next = vi.fn();
    createUploadCleanup(driver)({ file: { path: filePath } }, res, next);
    expect(next).toHaveBeenCalled();
    res.emit('finish');
    await new Promise((r) => setTimeout(r, 30));
  };

  it('в режиме s3 копия удаляется, даже если запрос провалился', async () => {
    // Раньше при ошибке валидации копия оставалась во временном каталоге навсегда.
    const f = tmpFile();
    await run('s3', 400, f);
    expect(fs.existsSync(f)).toBe(false);
  });

  it('в локальном режиме успешно сохранённый файл не трогается', async () => {
    // Здесь файл и есть хранилище — его удаление потеряло бы загрузку.
    const f = tmpFile();
    await run('local', 200, f);
    expect(fs.existsSync(f)).toBe(true);
    fs.unlinkSync(f);
  });

  it('в локальном режиме файл провалившегося запроса удаляется', async () => {
    const f = tmpFile();
    await run('local', 422, f);
    expect(fs.existsSync(f)).toBe(false);
  });
});
