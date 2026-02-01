const { extractAndCompressImages } = require("./utils/extractImg.js");
const { downloadSwfWithRetry } = require("./utils/downloadSwf.js");
const { exportImages, checkFfdecAvailable } = require("./utils/ffdecExport.js");
const logger = require("./utils/logger.js");
const fs = require("fs").promises;
const path = require("path");

const baseUrl = "https://seer.61.com/resource/effectIcon/";
const swfDir = "./swf";
const imgDir = "./img";

/**
 * 解析命令行参数，支持单个数字、逗号分隔的多个数字、范围（如1-10）
 * @param {string[]} args 命令行参数
 * @returns {number[]} 解析后的序号数组
 */
function parseArgs(args) {
  const ids = new Set();

  for (const arg of args) {
    // 处理范围格式，如 1-10
    if (arg.includes("-") && !arg.startsWith("-")) {
      const [start, end] = arg.split("-").map(Number);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          ids.add(i);
        }
      }
    }
    // 处理逗号分隔格式，如 1,2,3
    else if (arg.includes(",")) {
      arg.split(",").forEach((num) => {
        const id = Number(num.trim());
        if (!isNaN(id)) {
          ids.add(id);
        }
      });
    }
    // 处理单个数字
    else {
      const id = Number(arg);
      if (!isNaN(id)) {
        ids.add(id);
      }
    }
  }

  return Array.from(ids).sort((a, b) => a - b);
}

/**
 * 下载并保存 SWF 文件
 * @param {number} id SWF 序号
 * @returns {Promise<string>} 保存的 SWF 文件路径
 */
async function downloadAndSaveSwf(id) {
  const url = `${baseUrl}${id}.swf`;
  const swfPath = path.join(swfDir, `${id}.swf`);

  await fs.mkdir(swfDir, { recursive: true });

  const data = await downloadSwfWithRetry(url);
  await fs.writeFile(swfPath, Buffer.from(data));
  logger.success(`SWF 文件已保存: ${swfPath}`);

  return swfPath;
}

/**
 * 保存图片，使用传入的序号作为文件名
 * @param {Array} images 图片数组
 * @param {number} id 序号
 * @param {string} outputDir 输出目录
 * @returns {Promise<Array>} 保存的文件信息
 */
async function saveImages(images, id, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  const savedFiles = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const extension = img.mimeType === "image/jpeg" ? "jpg" : "png";
    // 如果只有一张图片，直接用序号命名；多张图片则加后缀
    const fileName =
      images.length === 1
        ? `${id}.${extension}`
        : `${id}_${i + 1}.${extension}`;
    const filePath = path.join(outputDir, fileName);

    try {
      const buffer = Buffer.from(img.base64, "base64");
      await fs.writeFile(filePath, buffer);
      savedFiles.push({
        fileName,
        filePath,
        characterId: img.characterId,
        originalSize: img.originalSize,
        compressedSize: img.compressedSize,
        compressionRatio: (
          (1 - img.compressedSize / img.originalSize) *
          100
        ).toFixed(1),
      });

      logger.success(`保存图片: ${fileName}`);
    } catch (error) {
      logger.error(`保存图片失败: ${fileName}`, error.message);
    }
  }

  return savedFiles;
}

/**
 * 检查 img 目录中是否已存在该序号的图片
 * @param {number} id 序号
 * @returns {Promise<boolean>} 是否已存在
 */
async function checkImageExists(id) {
  const extensions = [".png", ".jpg", ".jpeg", ".svg"];
  for (const ext of extensions) {
    const filePath = path.join(imgDir, `${id}${ext}`);
    try {
      await fs.access(filePath);
      return true;
    } catch {}
  }
  return false;
}

/**
 * 处理单个序号：下载 SWF、提取图片、保存图片
 * @param {number} id 序号
 * @param {number} quality 图片质量
 * @param {boolean} useFfdec 是否使用 FFDec 导出
 */
async function processId(id, quality = 100, useFfdec = false) {
  if (await checkImageExists(id)) {
    return;
  }

  logger.info(`开始处理序号: ${id}`);

  try {
    const swfPath = await downloadAndSaveSwf(id);

    const images = await extractAndCompressImages(swfPath, quality);

    if (images.length > 0) {
      logger.info(`原生提取到 ${images.length} 张图片`);
      const savedFiles = await saveImages(images, id, imgDir);
      logger.success(`序号 ${id} 处理完成，共保存 ${savedFiles.length} 张图片`);
      return;
    }

    if (useFfdec) {
      logger.info(`原生提取无结果，使用 FFDec 精确导出 Sprite`);

      const result = await exportImages(swfPath, imgDir, id, {
        className: "item",
      });

      if (result.files.length > 0) {
        logger.success(
          `序号 ${id} 使用 FFDec 导出完成，共保存 ${result.files.length} 张图片 (方式: ${result.method})`
        );
      } else {
        logger.warn(`序号 ${id} 没有提取到图片`);
      }
    } else {
      logger.warn(
        `序号 ${id} 没有提取到位图图片（可能是矢量图形），使用 --ffdec 参数启用 FFDec 导出`
      );
    }
  } catch (error) {
    logger.error(`处理序号 ${id} 失败: ${error.message}`);
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
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
  --help, -h    显示帮助信息
`);
}

(async () => {
  const args = process.argv.slice(2);

  // 显示帮助
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  // 检查是否使用 FFDec
  const useFfdec = args.includes("--ffdec");
  const filteredArgs = args.filter((arg) => !arg.startsWith("--"));

  // 解析序号
  const ids = parseArgs(filteredArgs);

  if (ids.length === 0) {
    logger.error("未提供有效的序号参数");
    showHelp();
    return;
  }

  // 如果启用 FFDec，检查是否可用
  if (useFfdec) {
    const ffdecAvailable = await checkFfdecAvailable();
    if (!ffdecAvailable) {
      logger.warn("FFDec 不可用，将仅使用原生提取");
      logger.info("请安装 FFDec 并配置环境变量 FFDEC_PATH");
      logger.info(
        "下载地址: https://github.com/jindrapetrik/jpexs-decompiler/releases"
      );
    } else {
      logger.success("FFDec 已就绪");
    }
  }

  logger.info(`准备处理 ${ids.length} 个序号: ${ids.join(", ")}`);

  for (const id of ids) {
    await processId(id, 100, useFfdec);
    if (ids.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  logger.success(`全部处理完成，共处理 ${ids.length} 个序号`);
})();
