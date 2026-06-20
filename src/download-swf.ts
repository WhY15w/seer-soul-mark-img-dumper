import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { unzipSync } from 'node:zlib';
import axios from 'axios';
import { logger } from './logger.js';

/**
 * 判断是否是压缩的 SWF（以 CWS 开头）
 */
export function isCompressedSwf(buffer: Buffer): boolean {
  return buffer.subarray(0, 3).toString() === 'CWS';
}

/**
 * 解压 SWF 文件（CWS → FWS）
 */
export async function decompressSwf(inputPath: string, outputPath: string): Promise<string> {
  const rawBuffer = await readFile(inputPath);

  if (!isCompressedSwf(rawBuffer)) {
    logger.info('SWF文件未压缩，跳过解压步骤');
    await copyFile(inputPath, outputPath);
    return outputPath;
  }

  logger.info('检测到压缩的SWF文件，正在解压...');
  const header = rawBuffer.subarray(0, 8);
  const compressedBody = rawBuffer.subarray(8);

  const decompressedBody = unzipSync(compressedBody);

  const newHeader = Buffer.from(header);
  newHeader[0] = 'F'.charCodeAt(0);

  const finalBuffer = Buffer.concat([newHeader, decompressedBody]);
  await writeFile(outputPath, finalBuffer);
  logger.success('SWF文件解压完成');
  return outputPath;
}

/**
 * 带重试的 SWF 文件下载
 */
export async function downloadSwfWithRetry(url: string, maxRetries = 3): Promise<ArrayBuffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`正在下载SWF文件... (尝试 ${attempt}/${maxRetries})`);

      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      logger.success(`下载完成 (${(response.data.byteLength / 1024).toFixed(1)} KB)`);
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`下载失败 (尝试 ${attempt}/${maxRetries}): ${message}`);

      if (attempt === maxRetries) {
        throw new Error(`下载失败，已重试 ${maxRetries} 次: ${message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  // 类型安全：实际上不会执行到这里（循环内已 throw），但 TypeScript 需要
  throw new Error('下载失败：未知错误');
}
