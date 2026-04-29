#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

function parseArgs(argv) {
    const args = { files: [], config: null, output: null };
    let i = 2;

    while (i < argv.length) {
        const arg = argv[i];

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        } else if (arg === '--version' || arg === '-v') {
            const pkg = require('./package.json');
            console.log(`xhs-card v${pkg.version}`);
            process.exit(0);
        } else if (arg === '--config' || arg === '-c') {
            args.config = argv[++i];
        } else if (arg === '--output' || arg === '-o') {
            args.output = argv[++i];
        } else if (!arg.startsWith('-')) {
            args.files.push(arg);
        } else {
            console.error(`  ✗ 未知参数: ${arg}`);
            printHelp();
            process.exit(2);
        }
        i++;
    }

    return args;
}

function printHelp() {
    console.log(`
  xhs-card - 将 Markdown 转换为小红书文字卡片图片

  用法:
    xhs-card <files...> [options]

  参数:
    <files...>          Markdown 文件路径（支持 glob 通配符）

  选项:
    -c, --config <path> 指定 TOML 配置文件路径
    -o, --output <dir>  指定输出目录
    -h, --help          显示帮助信息
    -v, --version       显示版本号

  示例:
    xhs-card article.md
    xhs-card article.md -c my-config.toml
    xhs-card ./posts/*.md -o ./export
    xhs-card ./posts/*.md -c brand.toml -o ./export

  配置文件:
    未指定 -c 时，自动查找当前目录下的 xhs-card.toml
    均未找到则使用内置默认配置
`);
}

async function main() {
    const args = parseArgs(process.argv);

    if (args.files.length === 0) {
        console.error('  ✗ 请提供至少一个 Markdown 文件路径\n');
        printHelp();
        process.exit(2);
    }

    const { glob } = require('glob');
    const { loadConfig } = require('./src/config-loader');
    const { TemplateLoader } = require('./src/template-loader');
    const { MarkdownParser } = require('./src/markdown-parser');
    const { TextSplitter } = require('./src/text-splitter');
    const { CanvasRenderer } = require('./src/canvas-renderer');
    const { exportArticle } = require('./src/exporter');

    // 解析 glob 获取文件列表
    let files = [];
    for (const pattern of args.files) {
        const matches = await glob(pattern, { windowsPathsNoEscape: true });
        files.push(...matches);
    }
    files = [...new Set(files)].filter(f => f.endsWith('.md'));

    if (files.length === 0) {
        console.error('  ✗ 未找到匹配的 Markdown 文件');
        process.exit(2);
    }

    // 加载配置
    const config = loadConfig(args.config);
    const templateId = config._template || 'starry-night';
    console.log(`  ✓ 配置加载${args.config ? '：' + args.config : '：默认配置'} (模板: ${templateId})`);

    // 加载模板
    const templateLoader = new TemplateLoader();
    const templateConfig = templateLoader.loadTemplate(templateId, config);

    // 初始化引擎
    MarkdownParser.init();
    const splitter = new TextSplitter(templateConfig, templateId);
    const renderer = new CanvasRenderer();

    const exportFormat = config._exportFormat || 'jpeg';
    const exportQuality = config._exportQuality || 0.92;

    let totalImages = 0;
    let failedFiles = 0;

    for (const file of files) {
        try {
            const markdown = fs.readFileSync(file, 'utf-8');
            const pages = await splitter.split(markdown);

            if (pages.length === 0) {
                console.log(`  ⚠ 跳过：${path.basename(file)}（无可生成内容）`);
                continue;
            }

            // 计算输出目录
            const baseName = path.basename(file, '.md');
            let outputDir;
            if (args.output) {
                outputDir = path.resolve(args.output, baseName);
            } else {
                outputDir = path.resolve(path.dirname(file), baseName);
            }

            // 渲染并导出
            const canvases = [];
            for (let i = 0; i < pages.length; i++) {
                const canvas = await renderer.render({
                    layouts: pages[i],
                    index: i,
                    totalCount: pages.length,
                    config: templateConfig,
                    templateId
                });
                canvases.push(canvas);
            }

            exportArticle(canvases, outputDir, exportFormat, exportQuality);
            totalImages += pages.length;

            const firstFile = `01.${exportFormat === 'jpeg' ? 'jpg' : 'png'}`;
            const lastFile = `${String(pages.length).padStart(2, '0')}.${exportFormat === 'jpeg' ? 'jpg' : 'png'}`;
            console.log(`  ✓ 处理中：${path.basename(file)} → ${path.relative(process.cwd(), outputDir)}/`);
            console.log(`    → 生成 ${pages.length} 张图片 (${firstFile} ~ ${lastFile})`);
        } catch (err) {
            failedFiles++;
            console.error(`  ✗ 失败：${path.basename(file)} - ${err.message}`);
        }
    }

    console.log(`\n  完成！共处理 ${files.length - failedFiles} 篇文章，生成 ${totalImages} 张图片`);

    if (failedFiles > 0) {
        console.log(`  （${failedFiles} 篇处理失败）`);
        process.exit(1);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(`  ✗ 致命错误: ${err.message}`);
    process.exit(2);
});
