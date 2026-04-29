'use strict';

const { marked } = require('marked');

class MarkdownParser {
    static isInitialized = false;

    static init() {
        if (this.isInitialized) return;

        const highlightExtension = {
            name: 'highlight',
            level: 'inline',
            start(src) { return src.indexOf('=='); },
            tokenizer(src) {
                const rule = /^==([^=]+)==/;
                const match = rule.exec(src);
                if (match) {
                    return {
                        type: 'highlight',
                        raw: match[0],
                        text: match[1],
                        tokens: this.lexer.inlineTokens(match[1])
                    };
                }
            },
            renderer(token) { return `<mark class="highlight">${token.text}</mark>`; }
        };

        const centerBlockExtension = {
            name: 'centerBlock',
            level: 'block',
            start(src) {
                const match = src.match(/^[ \t]*:::[ \t]*center/m);
                return match ? match.index : undefined;
            },
            tokenizer(src) {
                const rule = /^[ \t]*:::[ \t]*center[ \t]*\n([\s\S]+?)\n[ \t]*:::[ \t]*(?:\n|$)/;
                const match = rule.exec(src);
                if (!match) return;

                const text = match[1].trim();
                if (!text) return;

                const childTokens = [];
                this.lexer.blockTokens(text, childTokens);

                return {
                    type: 'centerBlock',
                    raw: match[0],
                    text: text,
                    tokens: childTokens
                };
            },
            renderer(token) {
                return `<div style="text-align:center;">${this.parser.parse(token.tokens)}</div>`;
            }
        };

        marked.use({ extensions: [highlightExtension, centerBlockExtension] });
        marked.setOptions({ breaks: true, gfm: true });
        this.isInitialized = true;
    }

    static lexer(text) {
        if (!this.isInitialized) this.init();
        return marked.lexer(text);
    }
}

module.exports = { MarkdownParser };
