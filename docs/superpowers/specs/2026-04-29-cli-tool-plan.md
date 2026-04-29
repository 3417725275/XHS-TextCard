# XHS-TextCard CLI 实施计划

基于 [设计文档](./2026-04-29-cli-tool-design.md) 的分步实施计划。

## 阶段概览

| 阶段 | 内容 | 预计产出 |
|------|------|----------|
| 1 | 项目骨架搭建 | package.json、cli.js 入口、目录结构 |
| 2 | 配置系统 | config-loader.js、TOML 解析与合并 |
| 3 | 核心引擎移植 | markdown-parser、canvas-text-engine、text-splitter |
| 4 | 渲染引擎移植 | canvas-renderer、template-definitions、template-loader |
| 5 | 图片导出 | exporter.js，文件系统写入 |
| 6 | CLI 集成与测试 | 端到端流程打通、错误处理、输出格式 |

---

## 阶段 1：项目骨架搭建

**目标**：建立 CLI 项目基础结构，确认 node-canvas 安装正常。

### 步骤

1.1 创建 `cli/` 目录及子目录结构：
```
cli/
├── package.json
├── cli.js
├── src/
│   ├── utils/
```

1.2 编写 `package.json`：
- name: `xhs-card`
- bin 字段: `{ "xhs-card": "./cli.js" }`
- dependencies: `canvas`, `marked`, `toml`, `glob`
- engines: `{ "node": ">=16.0.0" }`

1.3 `cli.js` 入口文件骨架：
- shebang (`#!/usr/bin/env node`)
- 参数解析（使用 Node.js 内置 `process.argv` 手动解析，不引入额外 CLI 框架）
- 解析 `<files...>`, `-c/--config`, `-o/--output`
- 打印 help 信息

1.4 运行 `npm install`，验证 node-canvas 安装成功（创建简单 canvas 写入测试图片）

### 验收标准
- `node cli/cli.js --help` 输出帮助信息
- `node cli/cli.js test.md` 能正确解析参数并打印（暂不执行实际逻辑）

---

## 阶段 2：配置系统

**目标**：实现 TOML 配置文件加载、与模板默认值合并。

### 步骤

2.1 创建 `src/config-loader.js`：
- `loadConfig(configPath)` — 读取并解析 TOML 文件
- `mergeConfig(tomlConfig, templateDefaults)` — 将 TOML 配置覆盖到模板默认值上
- 字段映射：将 TOML 嵌套结构（`[typography]`, `[colors]`, `[cover]` 等）展平为与现有 config 对象兼容的扁平结构

2.2 配置字段映射表：
```
TOML                        → 内部 config key
template                    → (用于选择模板)
output.format               → exportFormat
output.quality              → exportQuality
typography.fontSize         → fontSize
typography.lineHeight       → lineHeight
typography.letterSpacing    → letterSpacing
typography.textPadding      → textPadding
typography.fontFamily       → fontFamily
typography.heading.h1Scale  → h1Scale
typography.heading.h2Scale  → h2Scale
typography.heading.h3Scale  → h3Scale
colors.background           → bgColor
colors.text                 → textColor
colors.accent               → accentColor
cover.enabled               → hasCover
cover.title                 → coverTitle
cover.fontSize              → coverFontSize
watermark.enabled           → hasWatermark
watermark.text              → watermarkText
watermark.color             → watermarkColor
signature.enabled           → hasSignature
signature.text              → signatureText
signature.color             → signatureColor
page.showNumber             → showPageNumber
```

2.3 配置查找逻辑：
- 有 `-c` 参数 → 加载该路径（不存在则 exit(2)）
- 无 `-c` → 查找 CWD 下 `xhs-card.toml`（不存在则返回空配置）

2.4 创建 `xhs-card.toml.example` 示例文件

### 验收标准
- 能正确解析示例 TOML 文件并输出合并后的 config 对象
- 缺少配置文件时优雅 fallback

---

## 阶段 3：核心引擎移植

**目标**：将 Markdown 解析、文本测量、分页算法移植到 Node.js 环境。

### 步骤

3.1 创建 `src/markdown-parser.js`：
- 从 `js/utils/markdown.js` 移植 `MarkdownParser` 类
- 导入 `marked` npm 包替代浏览器全局变量
- 注册 highlight 和 centerBlock 扩展
- 导出 `init()` 和 `parse()` 方法

3.2 创建 `src/utils/canvas-utils.js`：
- 从 `js/utils/canvas-utils.js` 移植 `CanvasUtils` 对象
- 改为 module.exports 导出
- 无需其他适配（纯数学计算 + ctx 操作）

3.3 创建 `src/canvas-text-engine.js`：
- 从 `js/utils/canvas-text-engine.js` 移植 `CanvasTextEngine` 类
- 替换 `document.createElement('canvas')` → `const { createCanvas } = require('canvas'); createCanvas(1, 1)`
- 引入 `canvas-utils.js`
- 引入 `constants.js` 的 `PREVIEW_WIDTH` 等常量
- 导出类

3.4 创建 `src/constants.js`：
- 直接复制 `js/constants.js`，改为 module.exports

3.5 创建 `src/text-splitter.js`：
- 从 `js/TextSplitter.js` 移植
- 引入 CanvasTextEngine、TemplateDefinitions、constants
- 替换全局变量引用为 require
- 导出类

### 验收标准
- 给定一段 Markdown 文本和 config，TextSplitter 能输出正确的分页 Layout 数组
- 文本测量结果与浏览器版本一致（可对比同一段文字的页数）

---

## 阶段 4：渲染引擎移植

**目标**：将 Canvas 渲染器和模板定义移植到 node-canvas 环境。

### 步骤

4.1 创建 `src/template-loader.js`：
- 用 `fs.readFileSync` + `JSON.parse` 加载 `../../templates/index.json`
- 加载指定模板的 JSON 文件
- 合并默认值逻辑（从 TemplateManager 移植）
- 路径解析使用 `path.resolve(__dirname, '../../templates/')`

4.2 创建 `src/template-definitions.js`：
- 从 `js/TemplateDefinitions.js` 移植整个对象
- 引入 canvas-utils
- 引入 constants
- 噪点纹理生成中的 `document.createElement('canvas')` → `createCanvas()`
- 导出对象

4.3 创建 `src/canvas-renderer.js`：
- 从 `js/CanvasRenderer.js` 移植 `CanvasRenderer` 类
- 关键适配：
  - `document.createElement('canvas')` → `createCanvas(width, height)`
  - `new Image()` + `img.src` → `const { loadImage } = require('canvas'); await loadImage(path)`
  - 图片加载支持本地文件路径和 HTTP URL
  - 社交图标加载路径改为 `path.resolve(__dirname, '../../assets/icons/')`
- 引入 template-definitions、canvas-text-engine、constants
- 导出类

4.4 处理渐变背景：
- `CanvasUtils.createGradient` 中的逻辑在 node-canvas 中兼容，无需改动
- `bgMode` 为 "gradient" 时需正确解析 CSS gradient 字符串

### 验收标准
- 给定 Layout 数组和 config，renderer 能输出一个 Canvas 对象
- canvas.toBuffer() 能生成可打开的图片文件

---

## 阶段 5：图片导出

**目标**：实现从 Canvas 到文件系统的导出能力。

### 步骤

5.1 创建 `src/exporter.js`：
- `exportPage(canvas, outputPath, format, quality)` — 单页导出
  - format='jpeg': `canvas.toBuffer('image/jpeg', { quality })`
  - format='png': `canvas.toBuffer('image/png')`
  - 写入 `fs.writeFileSync(outputPath, buffer)`
- `exportArticle(pages, outputDir, format, quality)` — 整篇文章导出
  - 创建输出目录（`fs.mkdirSync(dir, { recursive: true })`）
  - 遍历 pages 数组，依次导出 `01.jpg`, `02.jpg`, ...

5.2 输出路径计算：
- 无 `-o`：MD 文件同级创建同名目录
  - `./posts/article.md` → `./posts/article/01.jpg`
- 有 `-o`：在指定目录下创建子文件夹
  - `-o ./export` + `article.md` → `./export/article/01.jpg`

### 验收标准
- 导出的图片文件可正常打开
- JPEG 和 PNG 两种格式都能正确输出
- 目录不存在时自动创建

---

## 阶段 6：CLI 集成与测试

**目标**：串联所有模块，实现完整的端到端流程，添加错误处理和用户友好输出。

### 步骤

6.1 在 `cli.js` 中集成完整流程：
```javascript
// 伪代码
const files = resolveGlob(args.files);
const config = loadConfig(args.config);
const templateConfig = mergeWithTemplate(config);

for (const file of files) {
    const markdown = fs.readFileSync(file, 'utf-8');
    const pages = await splitter.split(markdown);
    for (let i = 0; i < pages.length; i++) {
        const canvas = await renderer.render({ layouts: pages[i], ... });
        exporter.exportPage(canvas, outputPath, format, quality);
    }
}
```

6.2 实现 CLI 输出格式：
- 进度提示（✓ 处理中：xxx.md → ./output/xxx/）
- 完成摘要（共处理 N 篇文章，生成 M 张图片）
- 错误信息（✗ 失败：xxx.md - 错误原因）

6.3 错误处理实现：
- try/catch 包裹每篇文章的处理，失败时记录并跳过
- 收集失败计数，决定退出码（0/1/2）
- 配置错误、参数错误立即退出

6.4 glob 批量处理：
- 使用 `glob` 包展开通配符
- Windows 路径兼容（使用 path.resolve 标准化）

6.5 端到端测试：
- 使用项目自带的 `data/default-text.md` 作为测试输入
- 验证各模板均能正确渲染输出
- 验证批量处理多文件场景
- 验证无配置文件时的默认行为

6.6 编写 README：
- 安装说明（含 node-canvas 系统依赖）
- 使用示例
- 配置文件说明

### 验收标准
- `node cli/cli.js ../data/default-text.md` 能生成完整的图片序列
- 切换不同模板均能正确渲染
- 批量处理 `../data/*.md` 正常工作
- 错误场景（文件不存在、TOML 语法错误）正确处理并输出友好提示
- `npm link` 后全局命令可用

---

## 实施顺序与依赖关系

```
阶段1（骨架）
  ↓
阶段2（配置）──→ 阶段3（引擎）
                    ↓
               阶段4（渲染）
                    ↓
               阶段5（导出）
                    ↓
               阶段6（集成）
```

阶段 2 和 3 可并行进行，但 4 依赖 3，5 依赖 4，6 串联所有。
