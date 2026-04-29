'use strict';

const fs = require('fs');
const path = require('path');

function exportArticle(canvases, outputDir, format = 'jpeg', quality = 0.92) {
    fs.mkdirSync(outputDir, { recursive: true });

    const ext = format === 'jpeg' ? 'jpg' : 'png';

    for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        const fileName = `${String(i + 1).padStart(2, '0')}.${ext}`;
        const filePath = path.join(outputDir, fileName);

        let buffer;
        if (format === 'jpeg') {
            buffer = canvas.toBuffer('image/jpeg', { quality });
        } else {
            buffer = canvas.toBuffer('image/png');
        }

        fs.writeFileSync(filePath, buffer);
    }
}

module.exports = { exportArticle };
