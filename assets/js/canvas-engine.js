/**
 * Qxuan Photobooth - Canvas Core Engine
 * Menangani pra-pemrosesan (Auto-Contrast & Sharpening), filter visual studio,
 * dan perakitan kolase foto beresolusi tinggi (HD Print Ready).
 */

class CanvasEngine {
    constructor() {
        // Preset warna bingkai studio
        this.frameThemes = {
            'white': { name: 'Studio White', bg: '#FFFFFF', text: '#18181B', border: '#E4E4E7' },
            'black': { name: 'Matte Obsidian', bg: '#18181B', text: '#FFFFFF', border: '#27272A' },
            'latte': { name: 'Warm Latte', bg: '#F5F0EA', text: '#2C2723', border: '#E5DDD3' },
            'cream': { name: 'Vintage Cream', bg: '#FFFDF7', text: '#3A3834', border: '#ECE6DA' },
            'sage':  { name: 'Soft Sage', bg: '#E2E8E2', text: '#283329', border: '#CDD7CD' },
            'blush': { name: 'Pastel Blush', bg: '#F8ECEC', text: '#3E2A2A', border: '#EBD4D4' }
        };
    }

    /**
     * Menerapkan pra-pemrosesan otomatis: Sharpening 3x3 convolution & Dynamic Auto-Contrast
     * Sangat penting untuk mengatasi keburaman kamera smartphone kelas menengah/entry-level.
     */
    enhanceRawCapture(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 1. Auto-Contrast & Luminance Dynamic Stretch
        this.applyAutoContrast(imgData);

        // 2. Sharpening Filter (Kernel konvolusi adaptif)
        const sharpenedData = this.applySharpenKernel(imgData, canvas.width, canvas.height, 0.35);

        ctx.putImageData(sharpenedData, 0, 0);
        return canvas;
    }

    /**
     * Algoritma Auto-Contrast (Histogram Min-Max Stretch dengan pemangkasan persentil 1% dan 99%)
     */
    applyAutoContrast(imgData) {
        const d = imgData.data;
        const totalPixels = d.length / 4;
        const hist = new Uint32Array(256);

        // Hitung histogram luminance
        for (let i = 0; i < d.length; i += 4) {
            const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
            hist[lum]++;
        }

        // Tentukan batas bawah (1%) dan batas atas (99%) untuk mencegah outlier titik cahaya/dead pixel
        const lowThreshold = totalPixels * 0.01;
        const highThreshold = totalPixels * 0.99;

        let count = 0;
        let minLum = 0;
        let maxLum = 255;

        for (let i = 0; i < 256; i++) {
            count += hist[i];
            if (count >= lowThreshold) { minLum = i; break; }
        }

        count = 0;
        for (let i = 255; i >= 0; i--) {
            count += hist[i];
            if (count >= (totalPixels - highThreshold)) { maxLum = i; break; }
        }

        if (maxLum <= minLum) return; // Kontras sudah seragam

        const range = maxLum - minLum;
        const scale = 255 / range;

        // Terapkan stretch pada kanal RGB
        for (let i = 0; i < d.length; i += 4) {
            d[i]     = Math.min(255, Math.max(0, (d[i] - minLum) * scale));
            d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - minLum) * scale));
            d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - minLum) * scale));
        }
    }

    /**
     * Sharpening Kernel 3x3 Convolution
     */
    applySharpenKernel(imgData, width, height, amount = 0.35) {
        const src = imgData.data;
        const output = new ImageData(new Uint8ClampedArray(src), width, height);
        const dst = output.data;

        // Bobot tengah vs tetangga
        const center = 1 + (4 * amount);
        const neighbor = -amount;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;

                for (let c = 0; c < 3; c++) {
                    const top    = ((y - 1) * width + x) * 4 + c;
                    const bottom = ((y + 1) * width + x) * 4 + c;
                    const left   = (y * width + (x - 1)) * 4 + c;
                    const right  = (y * width + (x + 1)) * 4 + c;

                    const val = (src[idx + c] * center) +
                                ((src[top] + src[bottom] + src[left] + src[right]) * neighbor);

                    dst[idx + c] = Math.min(255, Math.max(0, val));
                }
                dst[idx + 3] = src[idx + 3]; // Alpha tetap utuh
            }
        }
        return output;
    }

    /**
     * Menerapkan filter visual terpilih ke Canvas
     */
    applyFilter(sourceCanvas, filterType = 'normal') {
        const destCanvas = document.createElement('canvas');
        destCanvas.width = sourceCanvas.width;
        destCanvas.height = sourceCanvas.height;
        const ctx = destCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(sourceCanvas, 0, 0);

        if (filterType === 'normal') {
            return destCanvas;
        }

        const imgData = ctx.getImageData(0, 0, destCanvas.width, destCanvas.height);
        const d = imgData.data;

        switch (filterType) {
            case 'grayscale': // Monochrome Elegan
                for (let i = 0; i < d.length; i += 4) {
                    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    d[i] = gray;
                    d[i + 1] = gray;
                    d[i + 2] = gray;
                }
                break;

            case 'sepia': // Vintage Bronze
                for (let i = 0; i < d.length; i += 4) {
                    const r = d[i], g = d[i + 1], b = d[i + 2];
                    d[i]     = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    d[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    d[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;

            case 'vintage': // Vintage Warm (Golden nostalgic tones with lifted shadow)
                for (let i = 0; i < d.length; i += 4) {
                    let r = d[i], g = d[i + 1], b = d[i + 2];
                    r = Math.min(255, r * 1.08 + 10);
                    g = Math.min(255, g * 1.02 + 4);
                    b = Math.max(15, b * 0.88);
                    d[i] = r; d[i + 1] = g; d[i + 2] = b;
                }
                break;

            case 'cyberpunk': // High Contrast, punchy cool shadow & vibrant warmth
                for (let i = 0; i < d.length; i += 4) {
                    let r = d[i], g = d[i + 1], b = d[i + 2];
                    // Contrast boost curve
                    r = (r - 128) * 1.35 + 128;
                    g = (g - 128) * 1.25 + 128;
                    b = (b - 128) * 1.40 + 135;
                    d[i]     = Math.min(255, Math.max(0, r));
                    d[i + 1] = Math.min(255, Math.max(0, g));
                    d[i + 2] = Math.min(255, Math.max(0, b));
                }
                break;

            case 'smooth_skin': // Smooth Skin (Beauty filter pelindung kontur wajah)
                this.applySmoothSkin(imgData, destCanvas.width, destCanvas.height);
                break;
        }

        ctx.putImageData(imgData, 0, 0);
        return destCanvas;
    }

    /**
     * Filter Smooth Skin: Mendeteksi range pigmen warna kulit manusia secara natural
     * dan menerapkan peredaman bintik halus (gentle softening) tanpa memudarkan ketajaman mata & rambut.
     */
    applySmoothSkin(imgData, width, height) {
        const d = imgData.data;
        // Salin kanal asli untuk blending
        const original = new Uint8ClampedArray(d);

        for (let y = 1; y < height - 1; y += 2) {
            for (let x = 1; x < width - 1; x += 2) {
                const idx = (y * width + x) * 4;
                const r = original[idx];
                const g = original[idx + 1];
                const b = original[idx + 2];

                // Rule-based Skin Detection (Kovacs & Peer et al.)
                const isSkin = (r > 95 && g > 40 && b > 20 &&
                                (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                                Math.abs(r - g) > 15 && r > g && r > b);

                if (isSkin) {
                    // Gentle 3x3 local average blend pada area kulit
                    let avgR = 0, avgG = 0, avgB = 0, count = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nIdx = ((y + dy) * width + (x + dx)) * 4;
                            avgR += original[nIdx];
                            avgG += original[nIdx + 1];
                            avgB += original[nIdx + 2];
                            count++;
                        }
                    }
                    avgR /= count; avgG /= count; avgB /= count;

                    // Blend lembut 55% rata-rata + 45% detail asli agar tekstur pori natural tidak hilang
                    d[idx]     = (r * 0.45) + (avgR * 0.55);
                    d[idx + 1] = (g * 0.45) + (avgG * 0.55);
                    d[idx + 2] = (b * 0.45) + (avgB * 0.55);
                }
            }
        }
    }

    /**
     * Membangun Kolase Komposisi HD (Single, 2x1, 2x2, 3x1, 4x1)
     * Lengkap dengan frame bingkai studio, margin presisi, dan footer teks watermark.
     */
    composeCollage({
        photoCanvases,
        layoutMode = 'single',
        themeKey = 'white',
        customText = 'Qxuan Photobooth',
        dateString = '',
        frameStyle = 'solid', // 'solid', 'rounded', 'double'
        targetDPI = 300
    }) {
        const theme = this.frameThemes[themeKey] || this.frameThemes.white;
        const count = photoCanvases.length;

        // Standar dimensi Kanvas HD 300 DPI
        // 4R: 1200 x 1800 px (Rasio 2:3)
        // Photo Strip: 600 x 1800 px (Rasio 1:3)
        let canvasW = 1200;
        let canvasH = 1800;

        let cols = 1;
        let rows = 1;

        if (layoutMode === 'collage_2x1') {
            cols = 1; rows = 2;
            canvasW = 800; canvasH = 1600;
        } else if (layoutMode === 'collage_2x2') {
            cols = 2; rows = 2;
            canvasW = 1400; canvasH = 1750;
        } else if (layoutMode === 'collage_3x1') {
            cols = 1; rows = 3;
            canvasW = 750; canvasH = 1800;
        } else if (layoutMode === 'collage_4x1') {
            cols = 1; rows = 4;
            canvasW = 600; canvasH = 1800;
        }

        const outCanvas = document.createElement('canvas');
        outCanvas.width = canvasW;
        outCanvas.height = canvasH;
        const ctx = outCanvas.getContext('2d');

        // 1. Gambar latar belakang bingkai
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, canvasW, canvasH);

        // 2. Margin & Gutter
        const outerMargin = Math.round(canvasW * 0.05); // 5% margin luar
        const gutter = Math.round(canvasW * 0.025);     // 2.5% jarak antar foto
        const footerHeight = Math.round(canvasH * 0.11); // 11% ruang footer studio di bagian bawah

        const availableW = canvasW - (outerMargin * 2) - (gutter * (cols - 1));
        const availableH = canvasH - (outerMargin * 2) - footerHeight - (gutter * (rows - 1));

        const cellW = availableW / cols;
        const cellH = availableH / rows;

        // 3. Render setiap jepretan foto ke sel grid
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const photoIdx = (r * cols) + c;
                if (photoIdx >= count) continue;

                const photo = photoCanvases[photoIdx];
                const cellX = outerMargin + c * (cellW + gutter);
                const cellY = outerMargin + r * (cellH + gutter);

                ctx.save();

                // Style bingkai per sel
                if (frameStyle === 'rounded') {
                    this.roundRect(ctx, cellX, cellY, cellW, cellH, 16);
                    ctx.clip();
                }

                // Render gambar dengan fit cover proporsional
                this.drawImageCover(ctx, photo, cellX, cellY, cellW, cellH);

                ctx.restore();

                // Style garis bingkai ganda (double border)
                if (frameStyle === 'double') {
                    ctx.strokeStyle = theme.border;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cellX - 3, cellY - 3, cellW + 6, cellH + 6);
                }
            }
        }

        // 4. Render Footer & Watermark Elegan
        this.renderFooterText(ctx, canvasW, canvasH, footerHeight, theme, customText, dateString);

        return outCanvas;
    }

    /**
     * Menggambar teks branding studio dan watermark minimalis di bagian bawah bingkai
     */
    renderFooterText(ctx, canvasW, canvasH, footerHeight, theme, customText, dateString) {
        const footerY = canvasH - (footerHeight * 0.65);
        const activeDate = dateString || new Date().toLocaleDateString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }).replace(/\//g, '.');

        ctx.textAlign = 'center';
        ctx.fillStyle = theme.text;

        // Teks Utama (Brand Header)
        const brandFontSize = Math.max(18, Math.round(canvasW * 0.038));
        ctx.font = `600 ${brandFontSize}px "Plus Jakarta Sans", "Inter", -apple-system, sans-serif`;
        ctx.letterSpacing = '2px';
        ctx.fillText(customText.toUpperCase(), canvasW / 2, footerY);

        // Subteks (Tanggal & Minimal Studio Stamp)
        const subFontSize = Math.max(11, Math.round(canvasW * 0.020));
        ctx.font = `400 ${subFontSize}px "Inter", -apple-system, sans-serif`;
        ctx.fillStyle = (theme.bg === '#18181B') ? '#A1A1AA' : '#71717A';
        ctx.letterSpacing = '1.5px';
        ctx.fillText(`• ${activeDate} • STUDIO ARCHIVE`, canvasW / 2, footerY + (subFontSize * 1.8));

        // Kembalikan letter spacing default
        ctx.letterSpacing = '0px';
    }

    /**
     * Utility untuk menggambar gambar ke area kotak dengan proporsi cover (tanpa distorsi stretch)
     */
    drawImageCover(ctx, img, x, y, w, h) {
        const imgRatio = img.width / img.height;
        const targetRatio = w / h;

        let renderW, renderH, offsetX, offsetY;

        if (imgRatio > targetRatio) {
            renderH = h;
            renderW = h * imgRatio;
            offsetX = (w - renderW) / 2;
            offsetY = 0;
        } else {
            renderW = w;
            renderH = w / imgRatio;
            offsetX = 0;
            offsetY = (h - renderH) / 2;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(img, x + offsetX, y + offsetY, renderW, renderH);
        ctx.restore();
    }

    /**
     * Helper membuat rounded rectangle pada Canvas API
     */
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}

window.CanvasEngine = CanvasEngine;

