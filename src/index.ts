import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadSwfWithRetry } from './download-swf.js';
import { checkFfdecAvailable, exportImages } from './ffdec-export.js';
import { logger } from './logger.js';
import type { ImageData, SavedFile } from './types.js';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const BASE_URL = 'https://seer.61.com/resource/effectIcon/';
const SWF_DIR = './swf';
const IMG_DIR = './img';

// ---------------------------------------------------------------------------
// CLI 参数解析
// ---------------------------------------------------------------------------

/**
 * 解析命令行参数，支持单个数字、逗号分隔的多个数字、范围（如 1-10）
 */
export function parseArgs(args: string[]): number[] {
  const ids = new Set<number>();

  for (const arg of args) {
    // 处理范围格式，如 1-10
    if (arg.includes('-') && !arg.startsWith('-')) {
      const [start, end] = arg.split('-').map(Number);
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          ids.add(i);
        }
      }
    } else if (arg.includes(',')) {
      // 处理逗号分隔格式，如 1,2,3
      for (const num of arg.split(',')) {
        const id = Number(num.trim());
        if (!Number.isNaN(id)) {
          ids.add(id);
        }
      }
    } else {
      // 处理单个数字
      const id = Number(arg);
      if (!Number.isNaN(id)) {
        ids.add(id);
      }
    }
  }

  return Array.from(ids).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// 下载 & 保存
// ---------------------------------------------------------------------------

/**
 * 下载并保存 SWF 文件
 */
async function downloadAndSaveSwf(id: number): Promise<string> {
  const url = `${BASE_URL}${id}.swf`;
  const swfPath = path.join(SWF_DIR, `${id}.swf`);

  await mkdir(SWF_DIR, { recursive: true });

  const data = await downloadSwfWithRetry(url);
  await writeFile(swfPath, Buffer.from(data));
  logger.success(`SWF 文件已保存: ${swfPath}`);

  return swfPath;
}

/**
 * 保存图片，使用传入的序号作为文件名（用于原生提取模式）
 */
export async function saveImages(
  images: ImageData[],
  id: number,
  outputDir: string,
): Promise<SavedFile[]> {
  await mkdir(outputDir, { recursive: true });

  const savedFiles: SavedFile[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const extension = img.mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const fileName = images.length === 1 ? `${id}.${extension}` : `${id}_${i + 1}.${extension}`;
    const filePath = path.join(outputDir, fileName);

    try {
      const buffer = Buffer.from(img.base64, 'base64');
      await writeFile(filePath, buffer);
      savedFiles.push({
        fileName,
        filePath,
        characterId: img.characterId,
        originalSize: img.originalSize,
        compressedSize: img.compressedSize,
        compressionRatio: ((1 - img.compressedSize / img.originalSize) * 100).toFixed(1),
      });
      logger.success(`保存图片: ${fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`保存图片失败: ${fileName}`, message);
    }
  }

  return savedFiles;
}

// ---------------------------------------------------------------------------
// 存在性检查
// ---------------------------------------------------------------------------

/**
 * 检查 img 目录中是否已存在该序号的图片
 */
export async function checkImageExists(id: number): Promise<boolean> {
  const extensions = ['.png', '.jpg', '.jpeg', '.svg'];
  for (const ext of extensions) {
    const filePath = path.join(IMG_DIR, `${id}${ext}`);
    try {
      await access(filePath);
      return true;
    } catch {
      // 文件不存在，继续检查下一个扩展名
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 核心处理逻辑
// ---------------------------------------------------------------------------

/**
 * 处理单个序号：下载 SWF、提取图片、保存图片
 */
export async function processId(
  id: number,
  _quality = 100,
  useFfdec = false,
  force = false,
): Promise<void> {
  if (!force && (await checkImageExists(id))) {
    logger.info(`跳过序号 ${id}（图片已存在）`);
    return;
  }

  logger.info(`开始处理序号: ${id}`);

  try {
    const swfPath = await downloadAndSaveSwf(id);

    // 全员 SVG 矢量图，注释原生提取部分
    // const images = await extractAndCompressImages(swfPath, quality);
    // if (images.length > 0) { ... }

    if (useFfdec) {
      const result = await exportImages(swfPath, IMG_DIR, id, {
        className: 'item',
      });

      if (result.files.length > 0) {
        logger.success(
          `序号 ${id} 使用 FFDec 导出完成，共保存 ${result.files.length} 张图片 (方式: ${result.method})`,
        );
      } else {
        logger.warn(`序号 ${id} 没有提取到图片`);
      }
    } else {
      logger.warn(
        `序号 ${id} 没有提取到位图图片（可能是矢量图形），使用 --ffdec 参数启用 FFDec 导出`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`处理序号 ${id} 失败: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// 帮助信息
// ---------------------------------------------------------------------------

function showHelp(): void {
  console.log(`
用法: node index.js [选项] <序号...>

参数:
  <序号>    要下载的 SWF 序号，支持以下格式：
            - 单个数字: 2051
            - 多个数字: 2051 2052 2053
            - 逗号分隔: 2051,2052,2053
            - 范围: 2051-2055

示例:
  node index.js 2051              # 下载单个
  node index.js 2051 2052 2053    # 下载多个
  node index.js 2051,2052,2053    # 逗号分隔
  node index.js 2051-2055         # 范围下载
  node index.js 2051-2053 2060    # 混合使用
  node index.js --ffdec 2052      # 使用 FFDec 导出矢量图形

选项:
   --ffdec       使用 FFDec 导出（支持矢量图形）
                 需要安装 FFDec: https://github.com/jindrapetrik/jpexs-decompiler
                 可通过环境变量 FFDEC_PATH 指定路径
   --force, -f   即使图片已存在也强制重新提取并覆盖
   --help, -h    显示帮助信息
`);
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 显示帮助
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // 检查是否使用 FFDec
  const useFfdec = args.includes('--ffdec');
  const force = args.includes('--force') || args.includes('-f');
  const filteredArgs = args.filter((arg) => !arg.startsWith('--') && arg !== '-f');

  // 解析序号
  const ids = parseArgs(filteredArgs);

  if (ids.length === 0) {
    logger.error('未提供有效的序号参数');
    showHelp();
    return;
  }

  // 如果启用 FFDec，检查是否可用
  if (useFfdec) {
    const ffdecAvailable = await checkFfdecAvailable();
    if (!ffdecAvailable) {
      logger.warn('FFDec 不可用，将仅使用原生提取');
      logger.info('请安装 FFDec 并配置环境变量 FFDEC_PATH');
      logger.info('下载地址: https://github.com/jindrapetrik/jpexs-decompiler/releases');
    } else {
      logger.success('FFDec 已就绪');
    }
  }

  logger.info(`准备处理 ${ids.length} 个序号: ${ids.join(', ')}`);

  for (const id of ids) {
    await processId(id, 100, useFfdec, force);
    if (ids.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  logger.success(`全部处理完成，共处理 ${ids.length} 个序号`);
}

// 仅当直接运行时执行（非 import 时）
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
