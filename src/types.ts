/** 压缩后的图片数据 */
export interface ImageData {
  characterId: number;
  base64: string;
  mimeType: 'image/jpeg' | 'image/png';
  originalSize: number;
  compressedSize: number;
}

/** 保存后的文件信息 */
export interface SavedFile {
  fileName: string;
  filePath: string;
  characterId: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}

/** FFDec 导出选项 */
export interface FfdecOptions {
  className?: string;
  chid?: number;
  format?: 'png' | 'svg';
}

/** FFDec 导出结果 */
export interface ExportResult {
  files: string[];
  method: 'none' | 'sprite' | 'sprite/shape-last' | 'render';
}

/** SWF Tag 结构 */
export interface SwfTag {
  type: number;
  data: Buffer;
}

/** 解析后的 JPEG 图片 */
export interface JpegImage {
  characterId: number;
  buffer: Buffer;
  mimeType: 'image/jpeg';
}

/** 解析后的 PNG 图片 */
export interface PngImage {
  characterId: number;
  buffer: Buffer;
  mimeType: 'image/png';
}

/** 日志接口 */
export interface ILogger {
  info(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}
