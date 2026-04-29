# XHS-TextCard CLI 工具设计文档

> 将 XHS-TextCard 的核心渲染能力提取为 Node.js CLI 工具，通过命令行传入 Markdown 文件自动输出分页后的图片。

## 技术方案

Node.js + node-canvas。复用现有项目中的 JS 核心逻辑（TextSplitter、CanvasTextEngine、TemplateDefinitions），通过 node-canvas 提供与浏览器一致的 Canvas 2D API。

## CLI 接口

### 调用方式

```bash
# 单文件
node cli/cli.js article.md
xhs-card article.md

# 指定配置文件
xhs-card article.md -c ./my-config.toml

# 指定输出目录
xhs-card article.md -o ./output

# 批量处理（支持 glob 通配符）
xhs-card ./posts/*.md
xhs-card ./posts/*.md -c brand-config.toml -o ./export
```

### 参数

| 参数 | 缩写 | 必填 | 说明 |
|------|------|------|------|
| `<files...>` | — | 是 | 一个或多个 Markdown 文件路径，支持 glob |
| `--config` | `-c` | 否 | TOML 配置文件路径 |
| `--output` | `-o` | 否 | 输出目录 |

### 配置文件查找策略

1. 显式传入 `-c path` → 使用该文件（不存在则报错退出）
2. 未传 `-c` → 在 CWD 查找 `xhs-card.toml`
3. CWD 也没有 → 静默使用内置默认配置

### 输出规则

- 默认输出到 MD 文件同级目录，创建同名文件夹（`article.md` → `article/01.jpg, 02.jpg, ...`）
- 指定 `-o` 时，批量模式下在输出目录内为每篇文章创建子文件夹
- 文件命名：`01.jpg`, `02.jpg`, ...（序号对应页码）

### 两种运行方式

- **脚本方式**：`node cli/cli.js input.md`
- **全局命令**：执行 `npm link` 后可在任意目录使用 `xhs-card input.md`

## TOML 配置文件结构

```toml
# 模板选择（可选，默认 "starry-night"）
template = "starry-night"

# 输出设置
[output]
format = "jpeg"          # "jpeg" | "png"
quality = 0.92           # JPEG 质量 (0-1)，仅 jpeg 生效

# 排版参数
[typography]
fontSize = 16
lineHeight = 1.6
letterSpacing = 0
textPadding = 35
fontFamily = "Microsoft YaHei"

# 标题缩放比例
[typography.heading]
h1Scale = 1.8
h2Scale = 1.4
h3Scale = 1.2

# 颜色（支持所有 CSS 合法格式：hex、rgb()、hsl()、命名色、rgba()）
[colors]
background = "#1a1a2e"   # 深海蓝
text = "#e0e0e0"         # 浅灰
accent = "#64ffda"       # 薄荷绿

# 封面
[cover]
enabled = true
# title 不配置则自动从文章第一个 # 标题提取
fontSize = 28

# 水印
[watermark]
enabled = false
text = "原创内容"
color = "rgba(255,255,255,0.05)"

# 签名
[signature]
enabled = true
text = "我的小红书ID"
color = "#555555"

# 页码
[page]
showNumber = true
```

### 配置合并策略

配置文件中的值覆盖模板 JSON 中的默认值（浅合并）。所有字段均为可选，缺省时使用模板定义的默认值。

### 颜色格式

支持所有 CSS 合法颜色格式，因为 node-canvas 原生兼容：
- HEX：`"#1a1a2e"`, `"#fff"`
- RGB：`"rgb(26, 26, 46)"`
- RGBA：`"rgba(100, 255, 218, 0.8)"`
- HSL：`"hsl(240, 28%, 14%)"`
- 命名色：`"darkslateblue"`, `"lime"`, `"white"`

## 项目结构

```
XHS-TextCard/
├── cli/                          ← 新增 CLI 工具
│   ├── package.json
│   ├── cli.js                    ← 入口：参数解析 + 流程编排
│   ├── src/
│   │   ├── config-loader.js      ← TOML 配置加载与合并
│   │   ├── markdown-parser.js    ← Markdown 词法解析（marked + 自定义扩展）
│   │   ├── text-splitter.js      ← 智能分页算法
│   │   ├── canvas-text-engine.js ← 文本测量与布局引擎
│   │   ├── canvas-renderer.js    ← Canvas 绘制引擎（适配 node-canvas）
│   │   ├── template-loader.js    ← 加载 ../templates/*.json
│   │   ├── template-definitions.js ← 模板绘制逻辑
│   │   ├── exporter.js           ← 图片输出写入文件系统
│   │   └── utils/
│   │       └── canvas-utils.js   ← Canvas 工具函数
│   └── xhs-card.toml.example    ← 配置文件示例
├── js/                           ← 原有浏览器版本（不动）
├── templates/                    ← 共享模板 JSON（CLI 引用此目录）
└── ...
```

## 核心数据流

```
cli.js 入口
  │
  ├─ 解析参数（files, --config, --output）
  ├─ config-loader：读取 TOML → 合并模板默认值 → 生成最终 config
  │
  ├─ 遍历每个 MD 文件：
  │   ├─ 读取文件内容（fs.readFileSync）
  │   ├─ markdown-parser：marked.lexer() → Token[]
  │   ├─ text-splitter：Token[] → Layout[][]（分页）
  │   │   └─ canvas-text-engine：测量文本宽高、计算换行
  │   ├─ canvas-renderer：逐页绘制 Canvas
  │   │   └─ template-definitions：调用模板绘制函数
  │   └─ exporter：Canvas → Buffer → 写入 .jpg/.png 文件
  │
  └─ 完成，打印输出摘要
```

## 模板支持

全部 12 个模板移植：ios-memo、swiss-studio、minimalist-magazine、aura-gradient、deep-night、pro-doc、starry-night、notion-style、polaroid、elegant-book、cinematic-film、blank。

模板通过配置文件中的 `template` 字段选择。

模板 JSON 加载路径：`cli/src/template-loader.js` 通过相对路径 `../../templates/` 引用项目根目录下的共享模板文件。如果通过 `npm link` 全局安装，路径解析基于包的实际安装位置（`__dirname` 定位），确保任何 CWD 下都能正确加载模板。

## 移植适配要点

| 原文件 | 改动点 |
|--------|--------|
| `TextSplitter.js` | 去掉浏览器全局变量，改为 ES module 导出 |
| `CanvasTextEngine` | `document.createElement('canvas')` → node-canvas `createCanvas()` |
| `CanvasRenderer` | 同上，图片加载改为 node-canvas `loadImage()` |
| `TemplateDefinitions` | 适配模块导出，基本逻辑不动 |
| `markdown.js` | marked 本身支持 Node.js，只需模块化 |
| `constants.js` | 不动 |

关键替换：
- `document.createElement('canvas')` → `createCanvas(w, h)`
- `new Image()` + `img.src = url` → `await loadImage(path)`
- `canvas.toDataURL()` → `canvas.toBuffer('image/jpeg', { quality })` 或 `canvas.toBuffer('image/png')`

## 字体处理

依赖系统已安装的字体。node-canvas 可读取系统字体目录（Windows: Microsoft YaHei；macOS: PingFang SC 等）。配置文件中 `fontFamily` 字段应填写系统中已安装的字体名。

## 封面页

- 配置 `[cover] enabled = true` 时生成封面
- 封面标题自动从 Markdown 文件的第一个 `#` 标题提取
- 提取不到标题时使用文件名作为 fallback

## 错误处理

| 场景 | 行为 |
|------|------|
| MD 文件不存在 | 报错并跳过该文件，继续处理其余文件 |
| 配置文件不存在（显式 `-c`） | 立即报错退出 |
| 配置文件不存在（未指定且 CWD 无默认文件） | 静默使用内置默认配置 |
| TOML 语法错误 | 报错退出，提示错误行号 |
| template 值无效 | 报错退出，列出可用模板名 |
| 输出目录无写入权限 | 报错退出 |
| 单篇文章处理失败 | 打印错误信息，跳过继续处理其余文章 |

### 退出码

- `0` — 全部成功
- `1` — 部分文件处理失败
- `2` — 致命错误（配置错误、参数错误等）

## CLI 输出格式

```
  ✓ 配置加载：brand.toml (模板: starry-night)
  ✓ 处理中：how-to-code.md → ./export/how-to-code/
    → 生成 5 张图片 (01.jpg ~ 05.jpg)
  ✓ 处理中：design-tips.md → ./export/design-tips/
    → 生成 3 张图片 (01.jpg ~ 03.jpg)

  完成！共处理 2 篇文章，生成 8 张图片
```

## 依赖

| 包名 | 用途 |
|------|------|
| `canvas` | node-canvas，Canvas 2D API |
| `marked` | Markdown 词法解析 |
| `toml` | TOML 配置文件解析 |
| `glob` | 文件通配符匹配 |

不引入 JSZip（CLI 直接写文件，无需打包 ZIP）。

## 安装

```bash
cd cli/
npm install

# 可选：注册全局命令
npm link
```

node-canvas 依赖系统编译工具：
- Windows：需要 windows-build-tools 或 Visual Studio Build Tools
- macOS：需要 Xcode Command Line Tools
- Linux：需要 build-essential、libcairo2-dev、libpango1.0-dev 等
