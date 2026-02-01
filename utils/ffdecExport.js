const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const logger = require("./logger");

// FFDec 路径配置
const FFDEC_PATH = "D:/ffdec/ffdec.bat";

// Java 选项：抑制警告并优化性能
const JAVA_OPTS = "--enable-native-access=ALL-UNNAMED -Xms64m -Xmx512m";

// 缓存 FFDec 可用性检查结果
let ffdecAvailableCache = null;

/**
 * 检查 FFDec 是否可用（带缓存）
 */
async function checkFfdecAvailable() {
  if (ffdecAvailableCache !== null) {
    return ffdecAvailableCache;
  }

  try {
    execSync(`"${FFDEC_PATH}" -help`, {
      stdio: "ignore",
      env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
      windowsHide: true,
    });
    ffdecAvailableCache = true;
    return true;
  } catch (error) {
    ffdecAvailableCache = false;
    return false;
  }
}

/**
 * 获取目录下所有导出的图片文件
 */
async function getExportedFiles(dir) {
  const files = [];

  async function walk(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if ([".png", ".jpg", ".jpeg", ".svg", ".gif"].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
    }
  }

  await walk(dir);
  return files;
}

/**
 * 使用 FFDec 导出 SWF 中的所有图片（包括矢量形状）
 */
async function exportWithFfdec(swfPath, outputDir, format = "svg") {
  const absoluteSwfPath = path.resolve(swfPath);
  const absoluteOutputDir = path.resolve(outputDir);

  await fs.mkdir(absoluteOutputDir, { recursive: true });

  try {
    const args = [
      "-export",
      "shape,image",
      absoluteOutputDir,
      absoluteSwfPath,
      "-format",
      `shape:${format},image:png`,
    ];

    execSync(`"${FFDEC_PATH}" ${args.join(" ")}`, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
      windowsHide: true,
    });

    return await getExportedFiles(absoluteOutputDir);
  } catch (error) {
    const exportedFiles = await getExportedFiles(absoluteOutputDir);
    if (exportedFiles.length > 0) {
      return exportedFiles;
    }
    throw error;
  }
}

/**
 * 使用 FFDec 导出 SWF 为单张图片（渲染整个 SWF）
 */
async function exportSwfAsImage(swfPath, outputPath, frame = 1) {
  const absoluteSwfPath = path.resolve(swfPath);
  const absoluteOutputPath = path.resolve(outputPath);

  await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });

  try {
    const args = [
      "-render",
      absoluteOutputPath,
      absoluteSwfPath,
      "-frame",
      frame.toString(),
    ];

    execSync(`"${FFDEC_PATH}" ${args.join(" ")}`, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
      windowsHide: true,
    });

    return absoluteOutputPath;
  } catch (error) {
    try {
      await fs.access(absoluteOutputPath);
      return absoluteOutputPath;
    } catch {
      throw error;
    }
  }
}

/**
 * 导出图片
 */
async function exportImages(swfPath, outputDir, id) {
  const ffdecAvailable = await checkFfdecAvailable();

  if (!ffdecAvailable) {
    logger.warn("FFDec 不可用，请安装 FFDec 并配置路径");
    return { files: [], method: "none" };
  }

  const tempDir = path.join(outputDir, `_temp_${id}`);

  try {
    const exportedFiles = await exportWithFfdec(swfPath, tempDir, "svg");

    if (exportedFiles.length === 0) {
      const outputPath = path.join(outputDir, `${id}.png`);
      await exportSwfAsImage(swfPath, outputPath);
      await fs.rm(tempDir, { recursive: true, force: true });
      return { files: [outputPath], method: "render" };
    }

    const finalFiles = [];
    for (let i = 0; i < exportedFiles.length; i++) {
      const srcPath = exportedFiles[i];
      const ext = path.extname(srcPath);
      const destFileName =
        exportedFiles.length === 1 ? `${id}${ext}` : `${id}_${i + 1}${ext}`;
      const destPath = path.join(outputDir, destFileName);

      await fs.copyFile(srcPath, destPath);
      finalFiles.push(destPath);
    }

    await fs.rm(tempDir, { recursive: true, force: true });
    return { files: finalFiles, method: "export" };
  } catch (error) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {}
    throw error;
  }
}

module.exports = {
  checkFfdecAvailable,
  exportWithFfdec,
  exportSwfAsImage,
  exportImages,
};
