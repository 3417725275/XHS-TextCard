'use strict';

const CanvasUtils = {
    drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, stroke = false, strokeStyle = '') {
        const r = typeof radius === 'number' ? { tl: radius, tr: radius, bl: radius, br: radius } : radius;
        ctx.beginPath();
        ctx.moveTo(x + r.tl, y);
        ctx.lineTo(x + width - r.tr, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr);
        ctx.lineTo(x + width, y + height - r.br);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
        ctx.lineTo(x + r.bl, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl);
        ctx.lineTo(x, y + r.tl);
        ctx.quadraticCurveTo(x, y, x + r.tl, y);
        ctx.closePath();

        if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = 1; ctx.stroke(); }
    },

    createGradient(ctx, cssGradient, width, height) {
        try {
            const angleMatch = cssGradient.match(/(\d+)deg/);
            const angle = angleMatch ? parseInt(angleMatch[1]) : 135;
            const colors = cssGradient.match(/(#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}|rgba?\(.*?\))/g);
            
            if (!colors || colors.length < 2) return null;

            const rad = (angle - 90) * (Math.PI / 180);
            const len = Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad));
            const x0 = width / 2 - Math.cos(rad) * (len / 2);
            const y0 = height / 2 - Math.sin(rad) * (len / 2);
            const x1 = width / 2 + Math.cos(rad) * (len / 2);
            const y1 = height / 2 + Math.sin(rad) * (len / 2);

            const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
            colors.forEach((color, index) => {
                gradient.addColorStop(index / (colors.length - 1), color);
            });
            
            return gradient;
        } catch (e) { 
            return null; 
        }
    },

    measureTextWidth(ctx, text, letterSpacing = 0) {
        if (!text) return 0;
        return ctx.measureText(text).width + (text.length * letterSpacing);
    },

    hexToRgba(hex, opacity = 1) {
        if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${opacity})`;
        let h = hex.replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
};

module.exports = { CanvasUtils };
