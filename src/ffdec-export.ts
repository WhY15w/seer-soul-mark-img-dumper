import { execSync } from 'node:child_process';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';
import type { ExportResult, FfdecOptions } from './types.js';

const FFDEC_JAVA = 'java';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FFDEC_JAR = path.resolve(__dirname, '../ffdec_24.1.2_nightly3395/ffdec.jar');
const FFDEC_JAR_PATH = DEFAULT_FFDEC_JAR;
const FFDEC_CORE_ARGS = ['-jar', FFDEC_JAR_PATH];
const JAVA_OPTS = '--enable-native-access=ALL-UNNAMED -Xms64m -Xmx512m';

/** FFDec 可用性缓存 */
let ffdecAvailableCache: boolean | null = null;

/**
 * 检查 FFDec 是否可用
 */
export async function checkFfdecAvailable(): Promise<boolean> {
  if (ffdecAvailableCache !== null) return ffdecAvailableCache;

  try {
    execSync(`${FFDEC_JAVA} ${FFDEC_CORE_ARGS.join(' ')} -help`, {
      stdio: 'ignore',
      env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
      windowsHide: true,
    });
    ffdecAvailableCache = true;
    return true;
  } catch {
    ffdecAvailableCache = false;
    return false;
  }
}

/**
 * 递归获取导出的图片文件
 */
async function getExportedFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let lastFile: string | null = null;

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(current, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.svg'].includes(ext)) {
          lastFile = p;
          if (p.includes('_item')) {
            files.push(p);
          }
        }
      }
    }
  }

  try {
    await walk(dir);
  } catch {
    // 目录可能不存在
  }

  // 如果没有匹配到 _item 的文件，但有图片文件，则返回最后一个
  if (files.length === 0 && lastFile) {
    return [lastFile];
  }

  return files;
}

/**
 * 通用 FFDec 导出函数
 */
async function exportByType(
  swfPath: string,
  outputDir: string,
  exportType: 'sprite' | 'shape',
  format: string = 'svg',
): Promise<string[]> {
  const absSwf = path.resolve(swfPath);
  const absOut = path.resolve(outputDir);

  await mkdir(absOut, { recursive: true });

  const args = ['-format', `${exportType}:${format}`, '-export', exportType, absOut, absSwf];

  execSync(`${FFDEC_JAVA} ${FFDEC_CORE_ARGS.join(' ')} ${args.join(' ')}`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
    windowsHide: true,
  });

  return await getExportedFiles(absOut);
}

/**
 * 按 class 或 chid 精确导出 Sprite
 */
async function exportSprite(
  swfPath: string,
  outputDir: string,
  { className: _className = 'item', chid: _chid = 7, format = 'svg' }: FfdecOptions = {},
): Promise<string[]> {
  return await exportByType(swfPath, outputDir, 'sprite', format);
}

/**
 * Fallback：整 SWF 渲染为一张图
 */
async function renderSwf(swfPath: string, outputPath: string, frame = 1): Promise<string> {
  const absSwf = path.resolve(swfPath);
  const absOut = path.resolve(outputPath);

  await mkdir(path.dirname(absOut), { recursive: true });

  execSync(
    `${FFDEC_JAVA} ${FFDEC_CORE_ARGS.join(' ')} -render "${absOut}" "${absSwf}" -frame ${frame}`,
    {
      encoding: 'utf-8',
      env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
      windowsHide: true,
    },
  );

  return absOut;
}

/**
 * FFDec 导出主入口
 */
export async function exportImages(
  swfPath: string,
  outputDir: string,
  id: number,
  options: FfdecOptions = {},
): Promise<ExportResult> {
  if (!(await checkFfdecAvailable())) {
    logger.warn('FFDec 不可用');
    return { files: [], method: 'none' };
  }

  const tempDir = path.join(outputDir, `_temp_${id}`);
  const format = options.format ?? 'svg';

  try {
    let files = await exportSprite(swfPath, tempDir, options);

    if (!files.length) {
      logger.info('sprite 模式无结果，尝试 shape 模式');

      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      files = await exportByType(swfPath, tempDir, 'shape', format);
    }

    if (!files.length) {
      const out = path.join(outputDir, `${id}.png`);
      await renderSwf(swfPath, out);
      return { files: [out], method: 'render' };
    }

    // 只保存最后一张图
    const lastFile = files[files.length - 1];
    const ext = path.extname(lastFile);
    const name = `${id}${ext}`;
    const dest = path.join(outputDir, name);
    await copyFile(lastFile, dest);

    return {
      files: [dest],
      method: files.length > 1 ? 'sprite/shape-last' : 'sprite',
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
