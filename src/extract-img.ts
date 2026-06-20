import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { Jimp } from 'jimp';
import { PNG } from 'pngjs';
import type { ImageData, JpegImage, PngImage, SwfTag } from './types.js';

/**
 * 读取 RECT 区域大小（SWF 文件头中的矩形区域）
 */
export function readRectSize(buffer: Buffer, offset: number): number {
  const firstByte = buffer[offset];
  const nbits = firstByte >> 3;
  const totalBits = 5 + nbits * 4;
  return Math.ceil(totalBits / 8);
}

/**
 * 获取 SWF 文件头大小
 */
export function getSwfHeaderSize(buffer: Buffer): number {
  const rectOffset = 8;
  const rectBytes = readRectSize(buffer, rectOffset);
  return 8 + rectBytes + 4;
}

/**
 * 解析 SWF 中的所有 Tag
 */
export function parseSwfTags(tagDataBuffer: Buffer): SwfTag[] {
  const tags: SwfTag[] = [];
  let pos = 0;

  while (pos + 2 <= tagDataBuffer.length) {
    const tagCodeAndLength = tagDataBuffer.readUInt16LE(pos);
    const tagType = tagCodeAndLength >> 6;
    let tagLength = tagCodeAndLength & 0x3f;
    pos += 2;

    if (tagLength === 0x3f) {
      if (pos + 4 > tagDataBuffer.length) break;
      tagLength = tagDataBuffer.readUInt32LE(pos);
      pos += 4;
    }

    if (pos + tagLength > tagDataBuffer.length) break;
    const tagBytes = tagDataBuffer.subarray(pos, pos + tagLength);
    tags.push({ type: tagType, data: tagBytes });
    pos += tagLength;
  }

  return tags;
}

/**
 * 压缩 JPEG 图片并返回 base64
 */
async function compressJPEG(buffer: Buffer, quality = 80): Promise<string> {
  const img = await Jimp.read(buffer);
  const jpeg = await img.getBuffer('image/jpeg', { quality });
  return jpeg.toString('base64');
}

/**
 * 压缩 PNG 图片并返回 base64
 */
async function compressPNG(buffer: Buffer, _quality = 80): Promise<string> {
  const img = await Jimp.read(buffer);
  const png = await img.getBuffer('image/png');
  return png.toString('base64');
}

/**
 * 解析 DefineBitsJPEG3 标签（type = 35）
 */
export function parseDefineBitsJPEG3(swfTags: SwfTag[]): JpegImage[] {
  const jpegImages: JpegImage[] = [];

  for (const tag of swfTags) {
    if (tag.type === 35) {
      const buf = tag.data;
      const characterId = buf.readUInt16LE(0);

      const alphaOffset = buf.readUInt32LE(2);
      const jpegStart = 6;
      const jpegEnd = jpegStart + alphaOffset;
      if (jpegEnd > buf.length) continue;

      jpegImages.push({
        characterId,
        buffer: buf.subarray(jpegStart, jpegEnd),
        mimeType: 'image/jpeg',
      });
    }
  }

  return jpegImages;
}

/**
 * 解析 DefineBitsLossless2 标签（type = 36）
 */
export function parseDefineBitsLossless2(swfTags: SwfTag[]): PngImage[] {
  const pngImages: PngImage[] = [];

  for (const tag of swfTags) {
    if (tag.type === 36) {
      const buf = tag.data;
      const characterId = buf.readUInt16LE(0);

      const bitmapFormat = buf.readUInt8(2);
      const width = buf.readUInt16LE(3);
      const height = buf.readUInt16LE(5);
      const zlibStart = 7;

      if (bitmapFormat !== 5) {
        console.warn(
          `❌ Unsupported BitmapFormat=${bitmapFormat} for DefineBitsLossless2 id=${characterId}`,
        );
        continue;
      }

      const zlibData = buf.subarray(zlibStart);
      let raw: Buffer;
      try {
        raw = inflateSync(zlibData);
      } catch (err) {
        console.warn(
          `❌ Failed to decompress DefineBitsLossless2 for id=${characterId}:`,
          err instanceof Error ? err.message : err,
        );
        continue;
      }

      const png = new PNG({ width, height });
      let offset = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (offset + 4 > raw.length) break;

          const a = raw[offset];
          const r = raw[offset + 1];
          const g = raw[offset + 2];
          const b = raw[offset + 3];
          const idx = (width * y + x) << 2;

          png.data[idx] = r;
          png.data[idx + 1] = g;
          png.data[idx + 2] = b;
          png.data[idx + 3] = a;

          offset += 4;
        }
      }

      const pngBuffer = PNG.sync.write(png);
      pngImages.push({
        characterId,
        buffer: pngBuffer,
        mimeType: 'image/png',
      });
    }
  }

  return pngImages;
}

/**
 * 从 SWF 文件中提取并压缩图片（支持 JPEG3 + Lossless2）
 */
export async function extractAndCompressImages(
  swfFilePath: string,
  quality = 80,
): Promise<ImageData[]> {
  const swfBuffer = readFileSync(swfFilePath);
  const signature = swfBuffer.subarray(0, 3).toString('ascii');

  let fullBuffer: Buffer;
  if (signature === 'CWS') {
    const body = swfBuffer.subarray(8);
    const uncompressed = inflateSync(body);
    const newHeader = Buffer.from(swfBuffer.subarray(0, 8));
    newHeader[0] = 'F'.charCodeAt(0); // CWS -> FWS
    fullBuffer = Buffer.concat([newHeader, uncompressed]);
  } else if (signature === 'FWS') {
    fullBuffer = swfBuffer;
  } else {
    throw new Error(`Unsupported SWF signature: ${signature}`);
  }

  const headerSize = getSwfHeaderSize(fullBuffer);
  const tagBuffer = fullBuffer.subarray(headerSize);
  const tags = parseSwfTags(tagBuffer);

  const jpegImages = parseDefineBitsJPEG3(tags);
  const pngImages = parseDefineBitsLossless2(tags);

  const compressedImages: ImageData[] = [];

  // 处理 JPEG 图片
  for (const img of jpegImages) {
    try {
      const base64 = await compressJPEG(img.buffer, quality);
      compressedImages.push({
        characterId: img.characterId,
        base64,
        mimeType: img.mimeType,
        originalSize: img.buffer.length,
        compressedSize: Buffer.from(base64, 'base64').length,
      });
    } catch (err) {
      console.error(`Failed to compress JPEG image ${img.characterId}:`, err);
    }
  }

  // 处理 PNG 图片
  for (const img of pngImages) {
    try {
      const base64 = await compressPNG(img.buffer, quality);
      compressedImages.push({
        characterId: img.characterId,
        base64,
        mimeType: img.mimeType,
        originalSize: img.buffer.length,
        compressedSize: Buffer.from(base64, 'base64').length,
      });
    } catch (err) {
      console.error(`Failed to compress PNG image ${img.characterId}:`, err);
    }
  }

  return compressedImages;
}
