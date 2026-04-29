'use strict';

const fs = require('fs');
const path = require('path');
const toml = require('toml');

/**
 * 加载并解析 TOML 配置，展平为与内部 config 兼容的对象
 */
function loadConfig(configPath) {
    let raw = null;

    if (configPath) {
        const resolved = path.resolve(configPath);
        if (!fs.existsSync(resolved)) {
            console.error(`  ✗ 配置文件不存在: ${resolved}`);
            process.exit(2);
        }
        raw = fs.readFileSync(resolved, 'utf-8');
    } else {
        const defaultPath = path.resolve(process.cwd(), 'xhs-card.toml');
        if (fs.existsSync(defaultPath)) {
            raw = fs.readFileSync(defaultPath, 'utf-8');
        }
    }

    if (!raw) return {};

    let parsed;
    try {
        parsed = toml.parse(raw);
    } catch (err) {
        console.error(`  ✗ TOML 语法错误 (行 ${err.line}, 列 ${err.column}): ${err.message}`);
        process.exit(2);
    }

    return flattenConfig(parsed);
}

/**
 * 将 TOML 嵌套结构展平为内部 config 对象
 */
function flattenConfig(parsed) {
    const config = {};

    // 顶层字段
    if (parsed.template) config._template = parsed.template;

    // [output]
    if (parsed.output) {
        if (parsed.output.format) config._exportFormat = parsed.output.format;
        if (parsed.output.quality !== undefined) config._exportQuality = parsed.output.quality;
    }

    // [typography]
    if (parsed.typography) {
        const t = parsed.typography;
        if (t.fontSize !== undefined) config.fontSize = t.fontSize;
        if (t.lineHeight !== undefined) config.lineHeight = t.lineHeight;
        if (t.letterSpacing !== undefined) config.letterSpacing = t.letterSpacing;
        if (t.textPadding !== undefined) config.textPadding = t.textPadding;
        if (t.fontFamily) config.fontFamily = t.fontFamily;

        if (t.heading) {
            if (t.heading.h1Scale !== undefined) config.h1Scale = t.heading.h1Scale;
            if (t.heading.h2Scale !== undefined) config.h2Scale = t.heading.h2Scale;
            if (t.heading.h3Scale !== undefined) config.h3Scale = t.heading.h3Scale;
        }
    }

    // [colors]
    if (parsed.colors) {
        const c = parsed.colors;
        if (c.background) config.bgColor = c.background;
        if (c.text) config.textColor = c.text;
        if (c.accent) config.accentColor = c.accent;
    }

    // [cover]
    if (parsed.cover) {
        const cv = parsed.cover;
        if (cv.enabled !== undefined) config.hasCover = cv.enabled;
        if (cv.title) config.coverTitle = cv.title;
        if (cv.fontSize !== undefined) config.coverFontSize = cv.fontSize;
    }

    // [watermark]
    if (parsed.watermark) {
        const w = parsed.watermark;
        if (w.enabled !== undefined) config.hasWatermark = w.enabled;
        if (w.text) config.watermarkText = w.text;
        if (w.color) config.watermarkColor = w.color;
    }

    // [signature]
    if (parsed.signature) {
        const s = parsed.signature;
        if (s.enabled !== undefined) config.hasSignature = s.enabled;
        if (s.text) config.signatureText = s.text;
        if (s.color) config.signatureColor = s.color;
    }

    // [page]
    if (parsed.page) {
        if (parsed.page.showNumber !== undefined) config.showPageNumber = parsed.page.showNumber;
    }

    return config;
}

module.exports = { loadConfig };
