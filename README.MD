### seer-soul-mark-img-dumper

一个用于从赛尔号精灵魂印 SWF 文件中提取并压缩魂印图片的小工具。

### 使用说明

1. 确保已安装 Node.js 和 pnpm。
2. 克隆本仓库并安装依赖：
   ```bash
   git clone <repo-url>
   cd seer-soul-mark-img-dumper
   pnpm install
   ```
3. 将 SWF 文件放入 `./swf` 目录。
4. 运行以下命令提取并压缩图片：
   ```bash
   pnpm start
   ```
5. 提取的图片将保存在 `./img` 目录。

### 功能介绍

- 支持提取 SWF 文件中的 JPEG 和 PNG 图片。
- 自动压缩提取的图片以节省存储空间。
- 处理多个 SWF 文件并批量提取图片。

### 目录结构

```
seer-soul-mark-img-dumper/
├── swf/                # 存放 SWF 文件的目录
├── img/                # 提取的图片将保存在此目录
├── utils/              # 工具函数目录
│   └── extractImg.js   # 主要的图片提取逻辑
├── package.json       # 项目配置文件
└── README.md          # 使用说明文件
```
