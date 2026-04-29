'use strict';

const fs = require('fs');
const path = require('path');
const { DEFAULT_BRAND_TEXT, DEFAULT_COVER_IMAGE } = require('./constants');

class TemplateLoader {
    constructor() {
        this.templatesDir = path.resolve(__dirname, '../../templates');
        this.templates = {};
    }

    getAvailableTemplates() {
        const indexPath = path.join(this.templatesDir, 'index.json');
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        return index.templates.map(t => t.id);
    }

    loadTemplate(templateId, userConfig = {}) {
        const templatePath = path.join(this.templatesDir, `${templateId}.json`);
        if (!fs.existsSync(templatePath)) {
            const available = this.getAvailableTemplates();
            console.error(`  ✗ 模板 "${templateId}" 不存在`);
            console.error(`    可用模板: ${available.join(', ')}`);
            process.exit(2);
        }

        const configData = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

        const baseConfig = {
            bgColor: "#FFFFFF",
            textColor: "#333333",
            bgMode: "solid",
            fontSize: 16,
            lineHeight: 1.8,
            letterSpacing: 0.5,
            textPadding: 40,
            fontFamily: "inherit",
            hasCover: true,
            coverImage: DEFAULT_COVER_IMAGE,
            coverTitle: "",
            hasWatermark: false,
            watermarkText: DEFAULT_BRAND_TEXT,
            watermarkColor: "rgba(0,0,0,0.1)",
            hasSignature: true,
            signatureText: DEFAULT_BRAND_TEXT,
            signatureColor: "#555555",
            signaturePosition: "bottom",
            signatureStyle: "modern-pill",
            h1Scale: 1.6,
            h2Scale: 1.4,
            h3Scale: 1.2,
            accentColor: "#333333",
            showPageNumber: true,
            hasSocialIcons: false,
            selectedSocialIcons: [],
            ...configData.config
        };

        // Merge user config (from TOML) on top, excluding internal keys starting with _
        const mergedConfig = { ...baseConfig };
        for (const [key, value] of Object.entries(userConfig)) {
            if (!key.startsWith('_') && value !== undefined) {
                mergedConfig[key] = value;
            }
        }

        return mergedConfig;
    }
}

module.exports = { TemplateLoader };
