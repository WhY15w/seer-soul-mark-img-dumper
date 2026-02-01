const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const logger = require("./logger");

// FFDec 路径
const FFDEC_PATH = "D:/ffdec/ffdec.bat";

// Java 运行参数
const JAVA_OPTS = "--enable-native-access=ALL-UNNAMED -Xms64m -Xmx512m";

// FFDec 可用性缓存
let ffdecAvailableCache = null;

/**
 * 检查 FFDec 是否可用
 */
async function checkFfdecAvailable() {
  if (ffdecAvailableCache !== null) return ffdecAvailableCache;

  try {
    execSync(`"${FFDEC_PATH}" -help`, {
      stdio: "ignore",
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
async function getExportedFiles(dir) {
  const files = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(current, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if ([".png", ".jpg", ".jpeg", ".svg"].includes(ext)) {
          // 只收集包含_item的文件，没招了 className 导出时不生效
          if (p.includes("_item")) {
            files.push(p);
          }
        }
      }
    }
  }

  try {
    await walk(dir);
  } catch {}
  return files;
}

/**
 * 按 class 或 chid 精确导出 Sprite
 * @param {string} swfPath
 * @param {string} outputDir
 * @param {Object} options
 * @param {string} [options.className] 例如 "item"
 * @param {number} [options.chid] 例如 7
 * @param {string} [options.format] 导出格式: "png" 或 "svg"，默认 "svg"
 */
async function exportSprite(
  swfPath,
  outputDir,
  { className = "item", chid = 7, format = "svg" }
) {
  const absSwf = path.resolve(swfPath);
  const absOut = path.resolve(outputDir);

  await fs.mkdir(absOut, { recursive: true });

  if (!className && typeof chid !== "number") {
    throw new Error("exportSprite 需要 className 或 chid 其中之一");
  }

  const args = [
    "-format",
    `sprite:${format}`,
    "-export",
    "sprite",
    absOut,
    absSwf,
  ];

  execSync(`"${FFDEC_PATH}" ${args.join(" ")}`, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
    windowsHide: true,
  });

  return await getExportedFiles(absOut);
}

/**
 * fallback：整 SWF 渲染为一张图
 */
async function renderSwf(swfPath, outputPath, frame = 1) {
  const absSwf = path.resolve(swfPath);
  const absOut = path.resolve(outputPath);

  await fs.mkdir(path.dirname(absOut), { recursive: true });

  execSync(`"${FFDEC_PATH}" -render "${absOut}" "${absSwf}" -frame ${frame}`, {
    encoding: "utf-8",
    env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
    windowsHide: true,
  });

  return absOut;
}

/**
 * 对外主入口
 *
 * @param {string} swfPath
 * @param {string} outputDir
 * @param {string} id 文件命名用
 * @param {Object} options
 * @param {string} [options.className] 推荐
 * @param {number} [options.chid] 兜底
 */
async function exportImages(swfPath, outputDir, id, options = {}) {
  if (!(await checkFfdecAvailable())) {
    logger.warn("FFDec 不可用");
    return { files: [], method: "none" };
  }

  const tempDir = path.join(outputDir, `_temp_${id}`);

  try {
    const files = await exportSprite(swfPath, tempDir, options);

    if (!files.length) {
      const out = path.join(outputDir, `${id}.png`);
      await renderSwf(swfPath, out);
      return { files: [out], method: "render" };
    }

    const finalFiles = [];
    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i]);
      const name = files.length === 1 ? `${id}${ext}` : `${id}_${i + 1}${ext}`;
      const dest = path.join(outputDir, name);
      await fs.copyFile(files[i], dest);
      finalFiles.push(dest);
    }

    return { files: finalFiles, method: "sprite" };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  checkFfdecAvailable,
  exportImages,
};
