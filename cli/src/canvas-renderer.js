'use strict';

const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const { CanvasUtils } = require('./utils/canvas-utils');
const { TemplateDefinitions } = require('./template-definitions');
const { PREVIEW_WIDTH, PREVIEW_HEIGHT, DEFAULT_BRAND_TEXT } = require('./constants');

class CanvasRenderer {
    constructor() {
        this.imageCache = new Map();
    }

    async loadImageSafe(src) {
        if (!src) return null;
        if (this.imageCache.has(src)) return this.imageCache.get(src);
        try {
            const img = await loadImage(src);
            this.imageCache.set(src, img);
            return img;
        } catch (e) {
            return null;
        }
    }

    async render(options) {
        const { layouts, index, totalCount, config, templateId, width = PREVIEW_WIDTH, height = PREVIEW_HEIGHT, scale = 1 } = options;

        const canvas = createCanvas(width * scale, height * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        // Preload images
        for (const layout of layouts) {
            if (layout.type === 'cover' && layout.image) await this.loadImageSafe(layout.image);
            else if (layout.type === 'image' && layout.src) await this.loadImageSafe(layout.src);
        }

        // 1. Background
        this.drawTemplateBackground(ctx, templateId, config, width, height);

        // 2. Text area background
        const textAreaRect = this.getTextAreaRect(config, width, height, templateId);
        this.drawTextAreaBackground(ctx, templateId, config, textAreaRect);

        // 3. Watermark
        if (config.hasWatermark) this.drawWatermark(ctx, config, width, height);

        // 4. Content
        if (layouts.length === 1 && layouts[0].type === 'cover') {
            this.drawCoverContent(ctx, layouts[0], config, width, height, templateId);
        } else {
            this.drawTextContent(ctx, layouts, config, textAreaRect, templateId);
        }

        // 5. Foreground
        const isCover = layouts.length === 1 && layouts[0].type === 'cover';
        this.drawTemplateForeground(ctx, templateId, config, width, height, index, totalCount, isCover);

        // 6. Signature
        if (config.hasSignature) this.drawSignature(ctx, config, width, height, templateId);

        return canvas;
    }

    drawCoverContent(ctx, layout, config, width, height, templateId) {
        const img = this.imageCache.get(layout.image);
        const padding = parseFloat(config.textPadding) || 40;
        const splitRatio = 0.6;
        const imageH = height * splitRatio;
        const textH = height - imageH;
        const textY = imageH;

        ctx.save();
        if (img) {
            const imgScale = Math.max(width / img.width, imageH / img.height);
            const x = (width / 2) - (img.width / 2) * imgScale;
            const y = (imageH / 2) - (img.height / 2) * imgScale;
            ctx.beginPath(); ctx.rect(0, 0, width, imageH); ctx.clip();
            ctx.drawImage(img, x, y, img.width * imgScale, img.height * imgScale);
            ctx.restore();
        } else {
            ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, width, imageH);
        }

        ctx.save();
        const fontSize = parseFloat(config.coverFontSize) || 48;
        const fontFamily = config.fontFamily === 'inherit' ? "'Microsoft YaHei', 'PingFang SC', sans-serif" : (config.fontFamily || "sans-serif");
        ctx.fillStyle = config.accentColor || '#000000';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `800 ${fontSize}px ${fontFamily}`;

        const titleText = String(layout.title || '未命名文档').replace(/\\n/g, '\n');
        const maxWidth = width - (padding * 2);
        const lines = [];
        titleText.split('\n').forEach(paragraph => {
            if (!paragraph) { lines.push(''); return; }
            const chars = paragraph.split('');
            let line = '';
            for (let n = 0; n < chars.length; n++) {
                const testLine = line + chars[n];
                if (ctx.measureText(testLine).width > maxWidth && n > 0) { lines.push(line); line = chars[n]; }
                else line = testLine;
            }
            if (line) lines.push(line);
        });

        const lineHeight = fontSize * (parseFloat(config.coverLineHeight) || 1.4);
        const totalTextHeight = lines.length * lineHeight;
        let startY = textY + (textH / 2) - (totalTextHeight / 2) + (fontSize * 0.4);
        lines.forEach((l, i) => { ctx.fillText(l, width / 2, startY + (i * lineHeight)); });
        ctx.restore();
    }

    getTextAreaRect(config, width, height, templateId) {
        if (typeof TemplateDefinitions.getContentBox === 'function') {
            return TemplateDefinitions.getContentBox(templateId, config, width, height);
        }
        const padding = parseFloat(config.textPadding) || 35;
        return { x: padding, y: padding, width: width - (padding * 2), height: height - (padding * 2) };
    }

    drawBackground(ctx, config, width, height) {
        ctx.save();
        if (config.bgMode === 'gradient' && typeof config.bgColor === 'string' && config.bgColor.includes('linear-gradient')) {
            const gradient = CanvasUtils.createGradient(ctx, config.bgColor, width, height);
            ctx.fillStyle = gradient || '#ffffff';
        } else {
            ctx.fillStyle = config.bgColor || '#ffffff';
        }
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    drawTemplateBackground(ctx, templateId, config, width, height) {
        this.drawBackground(ctx, config, width, height);
        const template = TemplateDefinitions[templateId];
        if (template && template.drawBackground) { ctx.save(); template.drawBackground(ctx, width, height, config); ctx.restore(); }
    }

    drawTextAreaBackground(ctx, templateId, config, rect) {
        const template = TemplateDefinitions[templateId];
        if (template && template.drawTextAreaBackground) { ctx.save(); template.drawTextAreaBackground(ctx, rect, config); ctx.restore(); }
    }

    drawTemplateForeground(ctx, templateId, config, width, height, index, totalCount, isCover) {
        if (isCover) return;
        const template = TemplateDefinitions[templateId];
        if (template && template.drawForeground) { ctx.save(); template.drawForeground(ctx, width, height, index, totalCount, config); ctx.restore(); }
    }

    drawWatermark(ctx, config, width, height) {
        ctx.save();
        ctx.fillStyle = config.watermarkColor || 'rgba(0,0,0,0.05)';
        ctx.font = '500 14px sans-serif';
        ctx.translate(width / 2, height / 2); ctx.rotate(-Math.PI / 6);
        const text = config.watermarkText || DEFAULT_BRAND_TEXT;
        for (let x = -width; x < width; x += 180) {
            for (let y = -height; y < height; y += 120) { ctx.fillText(text, x, y); }
        }
        ctx.restore();
    }

    drawTextContent(ctx, layouts, config, textAreaRect, templateId) {
        let currentY = textAreaRect.y;
        ctx.save(); ctx.textBaseline = 'top';
        const template = TemplateDefinitions[templateId];

        for (const layout of layouts) {
            if (layout.type === 'space') { currentY += layout.height; continue; }
            const contentY = currentY + (layout.marginTop || 0);
            if (layout.type === 'heading') {
                this.drawStyledLines(ctx, layout.lines, textAreaRect.x, contentY, config, templateId, textAreaRect.width, layout.align);
            } else if (layout.type === 'blockquote') {
                const indent = layout.indent || 20;
                ctx.fillStyle = config.accentColor || 'rgba(0,0,0,0.1)';
                ctx.fillRect(textAreaRect.x, contentY, 3, layout.height - (layout.marginTop || 0) - (layout.marginBottom || 0));
                this.drawStyledLines(ctx, layout.lines, textAreaRect.x + indent, contentY, config, templateId, textAreaRect.width - indent, layout.align);
            } else if (layout.type === 'list-item') {
                const fontSize = parseFloat(config.fontSize) || 16;
                const fontFamily = config.fontFamily === 'inherit' ? "'Microsoft YaHei', sans-serif" : (config.fontFamily || "sans-serif");
                ctx.font = `500 ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = config.accentColor || config.textColor;
                ctx.fillText(layout.prefix, textAreaRect.x, contentY);
                this.drawStyledLines(ctx, layout.lines, textAreaRect.x + layout.prefixWidth, contentY, config, templateId, textAreaRect.width - layout.prefixWidth, layout.align);
            } else if (layout.type === 'image') {
                this.drawInlineImage(ctx, layout, textAreaRect.x, contentY);
            } else if (layout.lines) {
                this.drawStyledLines(ctx, layout.lines, textAreaRect.x, contentY, config, templateId, textAreaRect.width, layout.align);
            }
            currentY += layout.height;
        }
        ctx.restore();
    }

    drawInlineImage(ctx, layout, x, y) {
        const img = this.imageCache.get(layout.src);
        if (img) {
            ctx.save();
            ctx.beginPath();
            CanvasUtils.drawRoundedRect(ctx, x, y, layout.width, layout.contentHeight, 8);
            ctx.clip();
            ctx.drawImage(img, x, y, layout.width, layout.contentHeight);
            ctx.restore();
        } else {
            ctx.fillStyle = '#f5f5f5'; ctx.fillRect(x, y, layout.width, layout.contentHeight);
            ctx.fillStyle = '#999'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('图片加载失败', x + layout.width / 2, y + layout.contentHeight / 2);
        }
    }

    drawStyledLines(ctx, lines, startX, startY, config, templateId, maxWidth, align = 'left') {
        if (!lines || !Array.isArray(lines)) return;
        let lineY = startY;
        const configFontSize = parseFloat(config.fontSize) || 16;
        const drawWidth = maxWidth || 0;

        for (const lineSegments of lines) {
            let segmentX = startX;
            let maxFontSize = configFontSize;
            if (Array.isArray(lineSegments) && lineSegments.length > 0) {
                maxFontSize = Math.max(...lineSegments.map(s => parseFloat(s.fontSize) || configFontSize));
            } else if (lineSegments && lineSegments.fontSize) {
                maxFontSize = parseFloat(lineSegments.fontSize);
            }
            const lineHeight = maxFontSize * (parseFloat(config.lineHeight) || 1.6);
            const letterSpacing = parseFloat(config.letterSpacing) || 0;

            if (align === 'center' && drawWidth > 0 && Array.isArray(lineSegments)) {
                let lineWidth = 0;
                for (const segment of lineSegments) {
                    const fontFamily = config.fontFamily === 'inherit' ? "'Microsoft YaHei', sans-serif" : (config.fontFamily || 'sans-serif');
                    ctx.font = `${segment.fontStyle || 'normal'} ${segment.fontWeight || 'normal'} ${parseFloat(segment.fontSize) || configFontSize}px ${fontFamily}`;
                    lineWidth += CanvasUtils.measureTextWidth(ctx, segment.text || '', letterSpacing);
                }
                segmentX = startX + (drawWidth - lineWidth) / 2;
            }

            if (Array.isArray(lineSegments)) {
                for (const segment of lineSegments) {
                    this.drawSegment(ctx, segment, segmentX, lineY, config, templateId);
                    segmentX += CanvasUtils.measureTextWidth(ctx, segment.text, letterSpacing);
                }
            } else {
                this.drawSegment(ctx, lineSegments, segmentX, lineY, config, templateId);
            }
            lineY += lineHeight;
        }
    }

    drawSegment(ctx, segment, x, y, config, templateId) {
        const fontStyle = segment.fontStyle || 'normal';
        const fontWeight = segment.fontWeight || 'normal';
        const fontSize = parseFloat(segment.fontSize) || parseFloat(config.fontSize) || 16;
        const fontFamily = config.fontFamily === 'inherit' ? "'Microsoft YaHei', sans-serif" : (config.fontFamily || "sans-serif");
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

        let textColor = config.textColor;
        let highlightColor = 'rgba(255, 243, 191, 0.7)';
        let codeBgColor = 'rgba(0,0,0,0.04)';

        const template = TemplateDefinitions[templateId];
        if (template && template.getTextStyles) {
            const styles = template.getTextStyles(segment, config);
            if (styles) {
                if (styles.textColor) textColor = styles.textColor;
                if (styles.highlightColor) highlightColor = styles.highlightColor;
                if (styles.codeBgColor) codeBgColor = styles.codeBgColor;
            }
        }

        const letterSpacing = parseFloat(config.letterSpacing) || 0;
        const metrics = ctx.measureText(segment.text);
        const width = metrics.width + (segment.text.length * letterSpacing);

        if (segment.isHighlight) {
            ctx.fillStyle = highlightColor;
            ctx.fillRect(x, y + fontSize * 0.1, width, fontSize * 1.1);
        } else if (segment.isCode) {
            ctx.fillStyle = codeBgColor;
            CanvasUtils.drawRoundedRect(ctx, x - 2, y + 1, width + 4, fontSize * 1.3, 4, ctx.fillStyle);
        }

        ctx.fillStyle = textColor;
        ctx.fillText(segment.text, x, y);

        if (segment.textDecoration === 'line-through') {
            ctx.strokeStyle = textColor;
            ctx.lineWidth = Math.max(1, fontSize / 14);
            ctx.beginPath(); ctx.moveTo(x, y + fontSize * 0.52); ctx.lineTo(x + width, y + fontSize * 0.52); ctx.stroke();
        }
    }

    drawSignature(ctx, config, width, height, templateId) {
        const sigText = config.signatureText || DEFAULT_BRAND_TEXT;
        const sigColor = config.signatureColor || '#555555';
        const sigStyle = config.signatureStyle || 'modern-pill';
        const fontFamily = config.fontFamily === 'inherit' ? "'Microsoft YaHei', sans-serif" : (config.fontFamily || "sans-serif");

        ctx.save();
        if (sigStyle === 'terminal') {
            const barHeight = 40;
            ctx.fillStyle = '#222'; ctx.fillRect(0, height - barHeight, width, barHeight);
            ctx.font = '700 13px monospace'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#39FF14'; ctx.textAlign = 'left'; ctx.fillText('> _', 25, height - barHeight / 2);
            ctx.fillStyle = sigColor; ctx.textAlign = 'right'; ctx.fillText(sigText, width - 25, height - barHeight / 2);
        } else if (sigStyle === 'modern-pill') {
            ctx.font = `600 13px ${fontFamily}`;
            const metrics = ctx.measureText(sigText);
            const pillWidth = metrics.width + 40, pillHeight = 30, pillY = height - 42;
            CanvasUtils.drawRoundedRect(ctx, (width - pillWidth) / 2, pillY, pillWidth, pillHeight, 15, sigColor);
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
            ctx.fillText(sigText, width / 2, pillY + pillHeight / 2 + 5);
        } else if (sigStyle === 'elegant-serif') {
            ctx.font = 'italic 600 15px serif';
            const textWidth = ctx.measureText(sigText).width;
            const lineWidth = 40, gap = 12;
            const startX = (width - (textWidth + (lineWidth + gap) * 2)) / 2;
            const ys = height - 35;
            ctx.strokeStyle = sigColor; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(startX, ys); ctx.lineTo(startX + lineWidth, ys);
            ctx.moveTo(width - startX - lineWidth, ys); ctx.lineTo(width - startX, ys); ctx.stroke();
            ctx.fillStyle = sigColor; ctx.globalAlpha = 1; ctx.textAlign = 'center';
            ctx.fillText(sigText, width / 2, ys + 6);
        } else if (sigStyle === 'glass-minimal') {
            ctx.font = `600 13px ${fontFamily}`;
            const boxWidth = ctx.measureText(sigText).width + 30, boxHeight = 32, ys = height - 45;
            CanvasUtils.drawRoundedRect(ctx, (width - boxWidth) / 2, ys, boxWidth, boxHeight, 16, 'rgba(255, 255, 255, 0.25)', true, 'rgba(255, 255, 255, 0.2)');
            ctx.fillStyle = sigColor; ctx.textAlign = 'center';
            ctx.fillText(sigText, width / 2, ys + boxHeight / 2 + 5);
        } else {
            ctx.fillStyle = sigColor; ctx.font = `600 13px ${fontFamily}`; ctx.textAlign = 'center';
            ctx.fillText(sigText, width / 2, height - 30);
        }
        ctx.restore();
    }
}

module.exports = { CanvasRenderer };
