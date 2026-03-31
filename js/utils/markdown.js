/**
 * MarkdownParser - Markdown 解析工具
 */
class MarkdownParser {
    static init() {
        if (typeof marked === 'undefined' || this.isInitialized) return;

        // 添加 ==高亮== 自定义语法
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

        // 添加 ::: center ... ::: 块级居中语法
        const centerBlockExtension = {
            name: 'centerBlock',
            level: 'block',
            start(src) {
                const match = src.match(/^[ \t]*:::[ \t]*center/m);
                return match ? match.index : undefined;
            },
            tokenizer(src) {
                // 支持多行块级语法：::: center\n内容\n:::
                const rule = /^[ \t]*:::[ \t]*center[ \t]*\n([\s\S]+?)\n[ \t]*:::[ \t]*(?:\n|$)/;
                const match = rule.exec(src);
                if (!match) return;

                const text = match[1].trim();
                if (!text) return;

                // 使用 blockTokens 解析内部内容，支持段落、加粗、高亮等所有 Markdown 语法
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

    static parse(text) {
        if (typeof marked === 'undefined') return text.replace(/\n/g, '<br>');
        if (!this.isInitialized) this.init();
        return marked.parse(text);
    }
}
