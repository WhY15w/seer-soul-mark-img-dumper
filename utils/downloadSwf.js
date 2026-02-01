const axios = require("axios");
const fs = require("fs").promises;
const zlib = require("zlib");

const logger = require("./logger");

// 判断是否是压缩的 SWF（以 CWS 开头）
function isCompressedSwf(buffer) {
  return buffer.slice(0, 3).toString() === "CWS";
}

// 解压 SWF 文件（仅处理 CWS -> FWS）
async function decompressSwf(inputPath, outputPath) {
  const rawBuffer = await fs.readFile(inputPath);

  if (!isCompressedSwf(rawBuffer)) {
    logger.info("SWF文件未压缩，跳过解压步骤");
    await fs.copyFile(inputPath, outputPath);
    return outputPath;
  }

  logger.info("检测到压缩的SWF文件，正在解压...");
  const header = rawBuffer.slice(0, 8);
  const compressedBody = rawBuffer.slice(8);

  const decompressedBody = zlib.unzipSync(compressedBody);

  const newHeader = Buffer.from(header);
  newHeader[0] = "F".charCodeAt(0);

  const finalBuffer = Buffer.concat([newHeader, decompressedBody]);
  await fs.writeFile(outputPath, finalBuffer);
  logger.success("SWF文件解压完成");
  return outputPath;
}

async function downloadSwfWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`正在下载SWF文件... (尝试 ${attempt}/${maxRetries})`);

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 5000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      logger.success(
        `下载完成 (${(response.data.length / 1024).toFixed(1)} KB)`
      );
      return response.data;
    } catch (error) {
      logger.warn(`下载失败 (尝试 ${attempt}/${maxRetries}): ${error.message}`);

      if (attempt === maxRetries) {
        throw new Error(`下载失败，已重试 ${maxRetries} 次: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

module.exports = {
  downloadSwfWithRetry,
  decompressSwf,
};
