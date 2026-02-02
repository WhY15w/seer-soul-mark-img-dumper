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
   node index.js
   ```
5. 提取的图片将保存在 `./img` 目录。

### 功能介绍

- 处理多个 SWF 文件并批量提取图片。
- 支持通过命令行参数指定序号范围或单个序号。
- 可选使用 FFDec 工具导出矢量图形。

### 命令行参数

- `<序号>`: 要下载的 SWF 序号，支持以下格式：
  - 单个数字: `2051`
  - 多个数字: `2051 2052 2053`
  - 逗号分隔: `2051,2052,2053`
  - 范围: `2051-2055`
- `--ffdec`: 使用 FFDec 导出（支持矢量图形）。
- `--help, -h`: 显示帮助信息。

### 示例

```bash
# 下载单个 SWF 文件并提取图片
node index.js 2051

# 下载多个 SWF 文件
node index.js 2051 2052 2053

# 使用逗号分隔的序号
node index.js 2051,2052,2053

# 下载范围内的 SWF 文件
node index.js 2051-2055

# 混合使用范围和单个序号
node index.js 2051-2053 2060

# 使用 FFDec 导出矢量图形
node index.js --ffdec 2052
```

### 目录结构

```
seer-soul-mark-img-dumper/
├── swf/                # 存放 SWF 文件的目录
├── img/                # 提取的图片将保存在此目录
├── utils/              # 工具函数目录
│   └── extractImg.js   # 主要的图片提取逻辑
├── package.json       # 项目配置文件
├── README.md          # 使用说明文件
└── index.js           # 主程序入口
```

### 注意事项

- 如果启用 FFDec，请确保已安装 java 环境。
