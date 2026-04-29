# xhs-card CLI

将 Markdown 转换为小红书文字卡片图片的命令行工具。

## 安装

```bash
cd cli/
npm install
```

> **注意**：node-canvas 需要系统编译工具：
> - Windows：Visual Studio Build Tools
> - macOS：`xcode-select --install`
> - Linux：`sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

### 注册全局命令（可选）

```bash
npm link
```

## 使用

```bash
# 直接运行
node cli.js article.md

# 使用配置文件
node cli.js article.md -c my-config.toml

# 指定输出目录
node cli.js article.md -o ./output

# 批量处理
node cli.js ./posts/*.md -c brand.toml -o ./export

# 全局命令（npm link 后）
xhs-card article.md
xhs-card ./posts/*.md -c config.toml -o ./export
```

## 配置文件

未指定 `-c` 时，自动查找当前目录下的 `xhs-card.toml`。

参见 [xhs-card.toml.example](./xhs-card.toml.example) 了解完整配置项。

## 可用模板

cinematic-film, starry-night, polaroid, notion-style, elegant-book, ios-memo, swiss-studio, minimalist-magazine, aura-gradient, deep-night, pro-doc, blank
