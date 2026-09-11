// ════════════════════════════════════════════════════════════════
// MasterUz — Резервное копирование базы изнутри бэкенда
// ────────────────────────────────────────────────────────────────
// Раньше бэкап делал GitHub Actions — и дважды молча перестал: с июня по
// июль (блокировка аккаунта по биллингу) и снова с 18 июля (отклонённая
// оплата). Вдобавок workflow ставил pg_dump 16, а сервер уже на
// PostgreSQL 18: старый клиент новый сервер не выгружает, так что бэкап
// падал бы даже после починки оплаты.
//
// Теперь дамп снимает сам контейнер бэкенда на Railway — рядом с базой,
// без внешней платформы запуска. Файл уходит в то же S3-хранилище под
// теми же именами, что и раньше, а сторож бэкапов (backupWatchdog) видит
// отметку об успехе и перестаёт тревожить.
//
// Формат совместим с прежним: masteruz-YYYYMMDD-HHMMSS.sql.gz, plain SQL.
// Восстановление: gunzip -c <файл> | psql "$DATABASE_URL"
// ════════════════════════════════════════════════════════════════

import { spawn, spawnSync } from 'child_process';
import zlib from 'zlib';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { markBackupSuccess } from './backupWatchdog.js';

const BACKUP_PREFIX = 'masteruz-';
const DUMP_TIMEOUT_MS = 10 * 60_000;
/** Предел для выгрузки в память. База сейчас ~27 МБ, сжатый дамп — единицы МБ. */
const MAX_BACKUP_BYTES = 1024 * 1024 * 1024;
/** Сколько самых свежих копий не удаляется никогда, независимо от возраста. */
export const MIN_BACKUPS_KEPT = 7;
/** Plain-дамп pg_dump заканчивается этой строкой — без неё дамп оборван. */
const DUMP_COMPLETE_MARKER = 'PostgreSQL database dump complete';

export interface BackupResult {
  key: string;
  bytes: number;
  durationMs: number;
  removed: string[];
}

/**
 * Параметры подключения для pg_dump — через переменные окружения libpq.
 *
 * Пароль не передаётся аргументом командной строки: аргументы любого
 * процесса видны в списке процессов контейнера.
 */
export function pgEnvFromUrl(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl);
  const env: Record<string, string> = {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

/** Имя файла бэкапа — в том же формате, что писал прежний workflow. */
export function backupKey(at: Date): string {
  const iso = at.toISOString();
  const date = iso.slice(0, 10).replace(/-/g, '');
  const time = iso.slice(11, 19).replace(/:/g, '');
  return `${BACKUP_PREFIX}${date}-${time}.sql.gz`;
}

/**
 * Какие копии удалить по сроку хранения.
 *
 * Самые свежие MIN_BACKUPS_KEPT не трогаются никогда: если бэкапы долго не
 * делались, правило «старше N дней» иначе удалило бы все прежние копии,
 * оставив одну-единственную — ровно после простоя, когда история нужнее всего.
 */
export function selectExpiredBackups(keys: string[], now: Date, retentionDays: number): string[] {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');

  return keys
    .map((key) => ({ key, match: key.match(/^masteruz-(\d{8})-(\d{6})/) }))
    .filter((x): x is { key: string; match: RegExpMatchArray } => x.match !== null)
    .map(({ key, match }) => ({ key, day: match[1], order: `${match[1]}${match[2]}` }))
    .sort((a, b) => b.order.localeCompare(a.order))
    .slice(MIN_BACKUPS_KEPT)
    .filter((b) => b.day < cutoff)
    .map((b) => b.key);
}

export function isBackupConfigured(): boolean {
  const b = config.backup;
  return Boolean(b.s3Endpoint && b.s3Bucket && b.s3AccessKey && b.s3SecretKey && process.env.DATABASE_URL);
}

export function isPgDumpAvailable(): boolean {
  try {
    return spawnSync('pg_dump', ['--version'], { timeout: 10_000 }).status === 0;
  } catch {
    return false;
  }
}

/** Снять plain-дамп и сжать его. Возвращает gzip целиком. */
async function dumpDatabase(databaseUrl: string): Promise<Buffer> {
  const child = spawn('pg_dump', ['--no-owner', '--no-privileges', '--format=plain'], {
    env: { ...process.env, ...pgEnvFromUrl(databaseUrl) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const gzip = zlib.createGzip({ level: 9 });
  const chunks: Buffer[] = [];
  let size = 0;
  let tail = '';
  let stderr = '';
  let timedOut = false;
  let tooLarge = false;

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, DUMP_TIMEOUT_MS);

  child.stdout!.on('data', (chunk: Buffer) => {
    tail = (tail + chunk.toString('utf8')).slice(-512);
  });
  child.stderr!.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString('utf8')).slice(-2000);
  });
  gzip.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BACKUP_BYTES) {
      tooLarge = true;
      child.kill('SIGKILL');
      return;
    }
    chunks.push(chunk);
  });
  child.stdout!.pipe(gzip);

  const exited = new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code));
  });
  const compressed = new Promise<void>((resolve, reject) => {
    gzip.on('end', resolve);
    gzip.on('error', reject);
  });

  try {
    const [code] = await Promise.all([exited, compressed]);
    if (timedOut) throw new Error('pg_dump не уложился в 10 минут');
    if (tooLarge) throw new Error('Дамп больше 1 ГБ — нужна потоковая выгрузка');
    if (code !== 0) throw new Error(`pg_dump завершился с кодом ${code}: ${stderr.trim().slice(-500)}`);
    // Обрыв соединения посреди выгрузки не всегда даёт ненулевой код, а
    // обрезанный дамп восстановится наполовину — проверяем маркер конца.
    if (!tail.includes(DUMP_COMPLETE_MARKER)) throw new Error('Дамп оборван: нет маркера завершения pg_dump');
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
}

async function createBackupS3(): Promise<{ client: any; mod: any; bucket: string }> {
  // Ленивый импорт — как в storage.ts: без настроенного бэкапа SDK не грузится.
  const mod: any = await import('@aws-sdk/client-s3' as string);
  const client = new mod.S3Client({
    endpoint: config.backup.s3Endpoint,
    region: config.backup.s3Region || 'auto',
    credentials: {
      accessKeyId: config.backup.s3AccessKey,
      secretAccessKey: config.backup.s3SecretKey,
    },
    forcePathStyle: true,
  });
  return { client, mod, bucket: config.backup.s3Bucket };
}

async function listBackupKeys(s3: { client: any; mod: any; bucket: string }): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3.client.send(
      new s3.mod.ListObjectsV2Command({ Bucket: s3.bucket, Prefix: BACKUP_PREFIX, ContinuationToken: token }),
    );
    for (const obj of page.Contents ?? []) if (obj.Key) keys.push(obj.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/**
 * Снять дамп, выгрузить его в хранилище и отметить успех.
 *
 * Отметка ставится только после того, как файл подтверждённо лёг в хранилище
 * целиком: дамп, не доехавший до S3, бэкапом не считается.
 */
export async function runDatabaseBackup(): Promise<BackupResult> {
  if (!isBackupConfigured()) {
    throw new Error('Хранилище бэкапов не настроено: нужны BACKUP_S3_ENDPOINT, _BUCKET, _ACCESS_KEY, _SECRET_KEY');
  }

  const startedAt = Date.now();
  const dump = await dumpDatabase(process.env.DATABASE_URL!);
  const key = backupKey(new Date());

  const s3 = await createBackupS3();
  await s3.client.send(
    new s3.mod.PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: dump, ContentType: 'application/gzip' }),
  );

  const head = await s3.client.send(new s3.mod.HeadObjectCommand({ Bucket: s3.bucket, Key: key }));
  if (Number(head.ContentLength) !== dump.length) {
    throw new Error(`Файл в хранилище неполный: ${head.ContentLength} из ${dump.length} байт`);
  }

  await markBackupSuccess();

  // Уборка старых копий — после успеха и без права сорвать сам бэкап.
  let removed: string[] = [];
  try {
    removed = selectExpiredBackups(await listBackupKeys(s3), new Date(), config.backup.retentionDays);
    for (const old of removed) {
      await s3.client.send(new s3.mod.DeleteObjectCommand({ Bucket: s3.bucket, Key: old }));
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'backup: не удалось удалить старые копии');
  }

  return { key, bytes: dump.length, durationMs: Date.now() - startedAt, removed };
}
