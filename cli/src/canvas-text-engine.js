'use strict';

const { createCanvas } = require('canvas');
const { CanvasUtils } = require('./utils/canvas-utils');
const { PREVIEW_WIDTH } = require('./constants');

class CanvasTextEngine {
    constructor(config = {}) {
        this.canvas = createCanvas(1, 1);
        this.ctx = this.canvas.getContext('2d');
        this.widthCache = new Map();
        this.updateConfig(config);
    }

    updateConfig(config) {
        const defaultFont = "'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif";
        const oldConfig = this.config || {};
        this.config = {
            fontSize: 16, lineHeight: 1.6, letterSpacing: 0,
            fontFamily: defaultFont, textPadding: 35, cardWidth: PREVIEW_WIDTH || 500,
            ...config
        };
        
        if (this.config.fontFamily === 'inherit' || !this.config.fontFamily) {
            this.config.fontFamily = defaultFont;
        }
        
        if (oldConfig.fontFamily !== this.config.fontFamily || 
            oldConfig.fontSize !== this.config.fontSize ||
            oldConfig.letterSpacing !== this.config.letterSpacing) {
            this.widthCache.clear();
        }
        
        this.drawWidth = config.drawWidth || (this.config.cardWidth - (parseFloat(this.config.textPadding) * 2 || 70));
    }

    setFont(options = {}) {
        const { fontSize = this.config.fontSize, fontWeight = 'normal', fontStyle = 'normal', fontFamily = this.config.fontFamily } = options;
        this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        return this.ctx.font;
    }

    measureTextWidth(text, fontSize = this.config.fontSize, fontWeight = 'normal', fontStyle = 'normal') {
        if (!text) return 0;
        
        const cacheKey = `${text}_${fontSize}_${fontWeight}_${fontStyle}`;
        if (this.widthCache.has(cacheKey)) {
            return this.widthCache.get(cacheKey);
        }

        this.setFont({ fontSize, fontWeight, fontStyle });
        const letterSpacing = parseFloat(this.config.letterSpacing) || 0;
        const width = CanvasUtils.measureTextWidth(this.ctx, text, letterSpacing);
        
        if (text.length < 10) {
            this.widthCache.set(cacheKey, width);
        }
        
        return width;
    }

    async measureImage(src, maxWidth = this.drawWidth) {
        const { loadImage } = require('canvas');
        try {
            const img = await loadImage(src);
            const ratio = img.height / img.width;
            const height = maxWidth * ratio;
            return { width: maxWidth, height, ratio, originalWidth: img.width, originalHeight: img.height };
        } catch (e) {
            return { width: maxWidth, height: 100, error: true };
        }
    }

    splitIntoLines(text, style = {}, maxWidth = this.drawWidth) {
        const { fontSize = this.config.fontSize, fontWeight = 'normal' } = style;
        const lines = [];
        let currentLine = '', currentWidth = 0;

        if (!text) return [];

        for (const char of text) {
            if (char === '\n') {
                lines.push(currentLine);
                currentLine = ''; currentWidth = 0;
                continue;
            }

            const charWidth = this.measureTextWidth(char, fontSize, fontWeight);
            if (currentWidth + charWidth > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = char; currentWidth = charWidth;
            } else {
                currentLine += char; currentWidth += charWidth;
            }
        }
        if (currentLine !== '') lines.push(currentLine);
        return lines;
    }

    async layoutToken(token) {
        const layouts = [];
        const baseLineHeight = this.config.fontSize * this.config.lineHeight;

        if (!token) return layouts;

        switch (token.type) {
            case 'centerBlock': {
                const childTokens = token.tokens || [];
                for (const child of childTokens) {
                    const childLayouts = await this.layoutToken(child);
                    for (const layout of childLayouts) {
                        layout.align = 'center';
                        layouts.push(layout);
                    }
                }
                break;
            }
            case 'image': {
                const imgData = await this.measureImage(token.href);
                const marginTop = 10, marginBottom = 20;
                layouts.push({
                    type: 'image',
                    src: token.href,
                    alt: token.text || '',
                    width: imgData.width,
                    height: (imgData.height || 100) + marginTop + marginBottom,
                    contentHeight: imgData.height || 100,
                    marginTop,
                    marginBottom
                });
                break;
            }
            case 'heading': {
                const scales = { 1: this.config.h1Scale || 1.6, 2: this.config.h2Scale || 1.4, 3: this.config.h3Scale || 1.2 };
                const fontSize = this.config.fontSize * (scales[token.depth] || 1.1);
                const lines = this.layoutInlineText(token.tokens || [{ type: 'text', text: token.text }], this.drawWidth, { 
                    fontSize, fontWeight: '800', headingLevel: token.depth 
                });
                
                const marginTop = fontSize * 0.6, marginBottom = fontSize * 0.4;
                layouts.push({
                    type: 'heading', depth: token.depth, lines,
                    height: marginTop + (lines.length * fontSize * this.config.lineHeight) + marginBottom,
                    marginTop, marginBottom
                });
                break;
            }
            case 'hr': {
                layouts.push({ type: 'divider', height: 20 });
                break;
            }
            case 'text':
            case 'paragraph': {
                if (token.tokens && token.tokens.length === 1 && token.tokens[0].type === 'image') {
                    return await this.layoutToken(token.tokens[0]);
                }
                
                const hasImage = token.tokens && token.tokens.some(t => t.type === 'image');
                if (hasImage) {
                    const subLayouts = [];
                    let currentTextTokens = [];
                    
                    for (const subToken of token.tokens) {
                        if (subToken.type === 'image') {
                            if (currentTextTokens.length > 0) {
                                subLayouts.push(...await this.layoutToken({ type: 'paragraph', tokens: currentTextTokens, text: '' }));
                                currentTextTokens = [];
                            }
                            subLayouts.push(...await this.layoutToken(subToken));
                        } else {
                            currentTextTokens.push(subToken);
                        }
                    }
                    
                    if (currentTextTokens.length > 0) {
                        subLayouts.push(...await this.layoutToken({ type: 'paragraph', tokens: currentTextTokens, text: '' }));
                    }
                    return subLayouts;
                }

                const lines = this.layoutInlineText(token.tokens || [{ type: 'text', text: token.text || '' }]);
                const marginBottom = this.config.fontSize * 0.8;
                layouts.push({
                    type: 'paragraph', lines, height: (lines.length * baseLineHeight) + marginBottom,
                    marginTop: 0, marginBottom
                });
                break;
            }
            case 'blockquote': {
                const indent = 20;
                const lines = this.layoutInlineText(token.tokens || [{ type: 'text', text: token.text }], this.drawWidth - indent);
                const marginBottom = this.config.fontSize * 0.8;
                layouts.push({
                    type: 'blockquote', lines, indent, height: (lines.length * baseLineHeight) + marginBottom,
                    marginTop: 0, marginBottom
                });
                break;
            }
            case 'list': {
                for (let i = 0; i < token.items.length; i++) {
                    const item = token.items[i];
                    const prefix = token.ordered ? `${i + 1}. ` : '• ';
                    const prefixWidth = this.measureTextWidth(prefix);
                    let inlineTokens = item.tokens || [];
                    if (inlineTokens.length === 1 && inlineTokens[0].type === 'paragraph') {
                        inlineTokens = inlineTokens[0].tokens || [];
                    }

                    const lines = this.layoutInlineText(inlineTokens, this.drawWidth - prefixWidth);
                    const marginBottom = this.config.fontSize * 0.8;
                    layouts.push({
                        type: 'list-item', prefix, prefixWidth, lines,
                        height: (lines.length * baseLineHeight) + marginBottom,
                        marginTop: 0, marginBottom
                    });
                }
                break;
            }
            case 'space': {
                layouts.push({ type: 'space', height: this.config.fontSize });
                break;
            }
            case 'code': {
                const lines = this.splitIntoLines(token.text);
                const marginBottom = this.config.fontSize * 0.8;
                layouts.push({
                    type: 'code-block',
                    lines: lines.map(text => ({ text, fontSize: this.config.fontSize * 0.9, isCode: true })),
                    height: (lines.length * baseLineHeight) + marginBottom,
                    marginTop: 0, marginBottom
                });
                break;
            }
        }
        return layouts;
    }

    layoutInlineText(inlineTokens, maxWidth = this.drawWidth, inheritedStyle = {}) {
        const lines = [];
        let currentLine = [], currentLineWidth = 0;

        if (!inlineTokens) return [];

        const processTokens = (tokens, currentStyle) => {
            for (const token of tokens) {
                const style = {
                    fontSize: currentStyle.fontSize || this.config.fontSize,
                    fontWeight: currentStyle.fontWeight || 'normal',
                    fontStyle: currentStyle.fontStyle || 'normal',
                    isHighlight: currentStyle.isHighlight || false,
                    isCode: currentStyle.isCode || false,
                    textDecoration: currentStyle.textDecoration || 'none',
                    headingLevel: currentStyle.headingLevel
                };

                if (token.type === 'strong' || token.type === 'bold') style.fontWeight = '700';
                if (token.type === 'em' || token.type === 'italic') style.fontStyle = 'italic';
                if (token.type === 'codespan' || token.type === 'code') style.isCode = true;
                if (token.type === 'del' || token.type === 'strikethrough') style.textDecoration = 'line-through';
                if (token.type === 'highlight' || (token.raw && token.raw.startsWith('==') && token.raw.endsWith('=='))) {
                    style.isHighlight = true;
                }

                if (token.type === 'br') {
                    if (currentLine.length > 0) lines.push(currentLine);
                    currentLine = [];
                    currentLineWidth = 0;
                    continue;
                }

                if (token.tokens && token.tokens.length > 0) {
                    processTokens(token.tokens, style);
                } else {
                    const text = token.text || token.raw || '';
                    if (!text) continue;

                    for (const char of Array.from(text)) {
                        const charWidth = this.measureTextWidth(char, style.fontSize, style.fontWeight, style.fontStyle);

                        if (currentLineWidth + charWidth > maxWidth && currentLine.length > 0) {
                            lines.push(currentLine);
                            currentLine = [{ ...style, text: char }];
                            currentLineWidth = charWidth;
                        } else {
                            const last = currentLine[currentLine.length - 1];
                            if (last && last.fontWeight === style.fontWeight && last.fontStyle === style.fontStyle && 
                                last.isHighlight === style.isHighlight && last.isCode === style.isCode && 
                                last.fontSize === style.fontSize && last.textDecoration === style.textDecoration &&
                                last.headingLevel === style.headingLevel) {
                                last.text += char;
                            } else {
                                currentLine.push({ ...style, text: char });
                            }
                            currentLineWidth += charWidth;
                        }
                    }
                }
            }
        };

        processTokens(inlineTokens, inheritedStyle);
        if (currentLine.length > 0) lines.push(currentLine);
        return lines;
    }

    getLineHeight(line, config) {
        const configFontSize = parseFloat(config.fontSize) || 16;
        const maxFontSize = Array.isArray(line) 
            ? Math.max(...line.map(s => parseFloat(s.fontSize) || configFontSize))
            : (parseFloat(line.fontSize) || configFontSize);
        return maxFontSize * (parseFloat(config.lineHeight) || 1.6);
    }

    splitLayout(layout, availableHeight) {
        if (!layout.lines || !Array.isArray(layout.lines) || layout.lines.length === 0) return null;

        const lines = layout.lines;
        let currentHeight = layout.marginTop || 0, splitIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const lineHeight = this.getLineHeight(lines[i], this.config);
            if (currentHeight + lineHeight > availableHeight) {
                splitIndex = i; break;
            }
            currentHeight += lineHeight;
        }

        if (splitIndex <= 0 || splitIndex >= lines.length) return null;

        const part1 = { ...layout, lines: lines.slice(0, splitIndex), height: currentHeight, marginBottom: 0 };
        const part2 = { ...layout, lines: lines.slice(splitIndex), marginTop: 0 };
        
        let part2ContentHeight = 0;
        part2.lines.forEach(line => part2ContentHeight += this.getLineHeight(line, this.config));
        part2.height = part2ContentHeight + (layout.marginBottom || 0);

        if (layout.type === 'list-item') {
            part2.type = 'paragraph'; part2.prefix = ''; 
        }

        return { part1, part2 };
    }
}

module.exports = { CanvasTextEngine };
