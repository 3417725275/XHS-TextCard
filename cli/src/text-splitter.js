'use strict';

const { CanvasTextEngine } = require('./canvas-text-engine');
const { PREVIEW_WIDTH, PREVIEW_HEIGHT } = require('./constants');

class TextSplitter {
    constructor(config, templateId = 'starry-night') {
        this.config = config;
        this.templateId = templateId;

        // Lazy-load to avoid circular dependency
        this.TemplateDefinitions = require('./template-definitions').TemplateDefinitions;

        this.engine = new CanvasTextEngine(config);
        this.calculateLayout();
        
        this.engine.updateConfig({
            ...config,
            drawWidth: this.contentWidth
        });
    }

    updateConfig(config, templateId) {
        this.config = config;
        if (templateId) this.templateId = templateId;
        
        this.calculateLayout();
        this.engine.updateConfig({
            ...config,
            drawWidth: this.contentWidth
        });
    }

    calculateLayout() {
        const contentBox = this.TemplateDefinitions.getContentBox(
            this.templateId, this.config, PREVIEW_WIDTH, PREVIEW_HEIGHT
        );
        this.maxHeight = contentBox.height;
        this.contentWidth = contentBox.width;
    }

    async split(text) {
        if (!text || !text.trim()) return [];

        const { MarkdownParser } = require('./markdown-parser');
        MarkdownParser.init();

        const { marked } = require('marked');
        let tokens = [];
        try {
            tokens = marked.lexer(text);
        } catch (e) {
            throw new Error('Markdown 解析失败: ' + e.message);
        }
        
        const pages = [];
        
        // 注入封面页
        if (this.config.hasCover) {
            let coverTitle = this.config.coverTitle;
            if (!coverTitle) {
                const firstContentToken = tokens.find(t => t.type === 'heading' || t.type === 'paragraph');
                if (firstContentToken) {
                    coverTitle = firstContentToken.text || firstContentToken.raw.split('\n')[0];
                }
            }
            pages.push([{
                type: 'cover',
                title: coverTitle || '未命名文档',
                image: this.config.coverImage
            }]);
        }

        let currentPage = { layouts: [], totalHeight: 0 };

        const processLayout = (layout) => {
            const availableHeight = this.maxHeight - currentPage.totalHeight;

            if (layout.height <= availableHeight) {
                currentPage.layouts.push(layout);
                currentPage.totalHeight += layout.height;
                return;
            }

            const splitResult = this.engine.splitLayout(layout, availableHeight);
            
            if (splitResult) {
                if (splitResult.part1.height > 0) {
                    currentPage.layouts.push(splitResult.part1);
                }
                pages.push(currentPage.layouts);
                currentPage = { layouts: [], totalHeight: 0 };
                processLayout(splitResult.part2);
            } else {
                if (currentPage.layouts.length > 0) {
                    pages.push(currentPage.layouts);
                    currentPage = { layouts: [], totalHeight: 0 };
                    processLayout(layout);
                } else {
                    currentPage.layouts.push(layout);
                    currentPage.totalHeight += layout.height;
                }
            }
        };

        for (const token of tokens) {
            if (token.type === 'hr') {
                if (currentPage.layouts.length > 0) {
                    pages.push(currentPage.layouts);
                    currentPage = { layouts: [], totalHeight: 0 };
                }
                continue;
            }

            const layouts = await this.engine.layoutToken(token);
            for (const layout of layouts) {
                processLayout(layout);
            }
        }

        if (currentPage.layouts.length > 0) {
            pages.push(currentPage.layouts);
        }

        return pages;
    }
}

module.exports = { TextSplitter };
