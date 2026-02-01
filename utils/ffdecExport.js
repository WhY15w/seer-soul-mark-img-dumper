const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const logger = require("./logger");

const FFDEC_JAVA = "java";

const DEFAULT_FFDEC_JAR = path.resolve(
  __dirname,
  "../ffdec_24.1.2_nightly3395/ffdec.jar"
);
const FFDEC_JAR_PATH = process.env.FFDEC_JAR_PATH || DEFAULT_FFDEC_JAR;
const FFDEC_CORE_ARGS = ["-jar", FFDEC_JAR_PATH];
const JAVA_OPTS = "--enable-native-access=ALL-UNNAMED -Xms64m -Xmx512m";

// FFDec 可用性缓存
let ffdecAvailableCache = null;

/**
 * 检查 FFDec 是否可用
 */
async function checkFfdecAvailable() {
  if (ffdecAvailableCache !== null) return ffdecAvailableCache;

  try {
    execSync(`${FFDEC_JAVA} ${FFDEC_CORE_ARGS.join(" ")} -help`, {
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
  let lastFile = null;

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(current, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if ([".png", ".jpg", ".jpeg", ".svg"].includes(ext)) {
          lastFile = p; // 记录最后一个图片文件
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

  // 如果没有匹配到_item的文件，但有图片文件，则返回最后一个
  if (files.length === 0 && lastFile) {
    return [lastFile];
  }

  return files;
}

/**
 * 通用导出函数
 * @param {string} swfPath
 * @param {string} outputDir
 * @param {string} exportType 导出类型: "sprite" 或 "shape"
 * @param {string} format 导出格式: "png" 或 "svg"
 */
async function exportByType(swfPath, outputDir, exportType, format = "svg") {
  const absSwf = path.resolve(swfPath);
  const absOut = path.resolve(outputDir);

  await fs.mkdir(absOut, { recursive: true });

  const args = [
    "-format",
    `${exportType}:${format}`,
    "-export",
    exportType,
    absOut,
    absSwf,
  ];

  execSync(`${FFDEC_JAVA} ${FFDEC_CORE_ARGS.join(" ")} ${args.join(" ")}`, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
    windowsHide: true,
  });

  return await getExportedFiles(absOut);
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
  return await exportByType(swfPath, outputDir, "sprite", format);
}

/**
 * fallback：整 SWF 渲染为一张图
 */
async function renderSwf(swfPath, outputPath, frame = 1) {
  const absSwf = path.resolve(swfPath);
  const absOut = path.resolve(outputPath);

  await fs.mkdir(path.dirname(absOut), { recursive: true });

  execSync(
    `${FFDEC_JAVA} ${FFDEC_CORE_ARGS.join(
      " "
    )} -render "${absOut}" "${absSwf}" -frame ${frame}`,
    {
      encoding: "utf-8",
      env: { ...process.env, JAVA_TOOL_OPTIONS: JAVA_OPTS },
      windowsHide: true,
    }
  );

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
  const format = options.format || "svg";

  try {
    let files = await exportSprite(swfPath, tempDir, options);

    if (!files.length) {
      logger.info(`sprite 模式无结果，尝试 shape 模式`);

      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      files = await exportByType(swfPath, tempDir, "shape", format);
    }

    if (!files.length) {
      const out = path.join(outputDir, `${id}.png`);
      await renderSwf(swfPath, out);
      return { files: [out], method: "render" };
    }

    // 只保存最后一张图
    const lastFile = files[files.length - 1];
    const ext = path.extname(lastFile);
    const name = `${id}${ext}`;
    const dest = path.join(outputDir, name);
    await fs.copyFile(lastFile, dest);

    return {
      files: [dest],
      method: files.length > 1 ? "sprite/shape-last" : "sprite",
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  checkFfdecAvailable,
  exportImages,
};
