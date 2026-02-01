const { extractAndCompressImages } = require("./utils/extractImg.js");
const fs = require("fs").promises;
const path = require("path");

async function saveImages(images, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  const savedFiles = [];
  for (const img of images) {
    const extension = img.mimeType === "image/jpeg" ? "jpg" : "png";
    const fileName = `image_${img.characterId}.${extension}`;
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

      console.log(`保存图片: ${fileName}`);
    } catch (error) {
      console.error(`保存图片失败: ${fileName}`, error.message);
    }
  }

  return savedFiles;
}

(async () => {
  const b64Img = await extractAndCompressImages("./swf/2051.swf", 100);
  const savedFiles = await saveImages(b64Img, "./img");
})();
