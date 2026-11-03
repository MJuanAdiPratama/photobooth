/**
 * Qxuan Photobooth - Canvas Core Engine (Color Studio Edition)
 * Menangani pra-pemrosesan (Auto-Contrast & Sharpening), 8 filter visual studio dramatis,
 * palet warna bingkai studio terlengkap (24+ warna), 6 variasi sudut foto inovatif, dan ekspor HD 300 DPI.
 */

class CanvasEngine {
    constructor() {
        // Palet Warna Bingkai Studio Terlengkap (Netral, Cerah/Karakter, & Deep/Royal)
        this.frameThemes = {
            // Netral & Pastel Studio
            'white':          { name: 'Studio White',    bg: '#FFFFFF', text: '#18181B', border: '#E4E4E7' },
            'latte':          { name: 'Warm Latte',      bg: '#F5F0EA', text: '#2C2723', border: '#E5DDD3' },
            'cream':          { name: 'Vintage Cream',   bg: '#FFFDF7', text: '#3A3834', border: '#ECE6DA' },
            'sand':           { name: 'Desert Sand',     bg: '#EFEBE9', text: '#4E342E', border: '#D7CCC8' },
            'sage':           { name: 'Soft Sage',       bg: '#E2E8E2', text: '#283329', border: '#CDD7CD' },
            'blush':          { name: 'Pastel Blush',    bg: '#F8ECEC', text: '#3E2A2A', border: '#EBD4D4' },
            'lavender':       { name: 'Lilac Lavender',  bg: '#EDE7F6', text: '#311B92', border: '#D1C4E9' },
            'sky':            { name: 'Sky Breeze',      bg: '#E1F5FE', text: '#01579B', border: '#B3E5FC' },
            'butter':         { name: 'Butter Yellow',   bg: '#FFFDE7', text: '#5D4037', border: '#FFF9C4' },

            // Warna Vibrant & Cerah Pop
            'doraemon_blue':  { name: 'Bright Cyan Blue',bg: '#0096E6', text: '#FFFFFF', border: '#81D4FA' },
            'sunny_yellow':   { name: 'Sunny Yellow',    bg: '#FFD54F', text: '#3E2723', border: '#FFE082' },
            'hokage_orange':  { name: 'Sunset Orange',   bg: '#FF6F00', text: '#FFFFFF', border: '#FFA726' },
            'hero_red':       { name: 'Scarlet Red',     bg: '#DC2626', text: '#FFFFFF', border: '#EF4444' },
            'anfield_red':    { name: 'Crimson Red',     bg: '#C8102E', text: '#FFFFFF', border: '#F87171' },
            'garnet_wine':    { name: 'Garnet Wine',     bg: '#A50044', text: '#FFFFFF', border: '#FB7185' },
            'crimson':        { name: 'Crimson Velvet',  bg: '#881337', text: '#FFFFFF', border: '#9F1239' },
            'terracotta':     { name: 'Warm Terracotta', bg: '#9A3412', text: '#FFFFFF', border: '#C2410C' },

            // Warna Deep, Royal & Gelap Elegan
            'royal_blue':     { name: 'Royal Sapphire',  bg: '#004D98', text: '#FFFFFF', border: '#3B82F6' },
            'chelsea_blue':   { name: 'Deep Cobalt',     bg: '#034694', text: '#FFFFFF', border: '#2563EB' },
            'classic_navy':   { name: 'Midnight Navy',   bg: '#0F172A', text: '#FFFFFF', border: '#1E293B' },
            'emerald_green':  { name: 'Emerald Green',   bg: '#047857', text: '#FFFFFF', border: '#059669' },
            'forest':         { name: 'Forest Pine',     bg: '#14532D', text: '#FFFFFF', border: '#166534' },
            'black':          { name: 'Matte Obsidian',  bg: '#18181B', text: '#FFFFFF', border: '#27272A' },
            'pitch_black':    { name: 'Jet Black',       bg: '#09090B', text: '#FFFFFF', border: '#18181B' }
        };
    }

    /**
     * Menerapkan pra-pemrosesan otomatis: Sharpening 3x3 convolution & Dynamic Auto-Contrast
     */
    enhanceRawCapture(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        this.applyAutoContrast(imgData);

        // Penajaman cerdas: Jalankan kernel konvolusi cepat jika piksel di bawah batas aman agar smartphone tetap gesit
        if (canvas.width * canvas.height <= 2500000) {
            const sharpenedData = this.applySharpenKernel(imgData, canvas.width, canvas.height, 0.25);
            ctx.putImageData(sharpenedData, 0, 0);
        } else {
            ctx.putImageData(imgData, 0, 0);
        }

        return canvas;
    }

    applyAutoContrast(imgData) {
        const d = imgData.data;
        const totalPixels = d.length / 4;
        const hist = new Uint32Array(256);

        // Sampling cepat setiap 4 piksel untuk mempercepat perhitungan histogram tanpa kehilangan akurasi
        for (let i = 0; i < d.length; i += 16) {
            const lum = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
            hist[lum]++;
        }

        const sampledPixels = Math.floor(totalPixels / 4);
        const lowThreshold = sampledPixels * 0.01;
        const highThreshold = sampledPixels * 0.99;

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
            if (count >= (sampledPixels - highThreshold)) { maxLum = i; break; }
        }

        if (maxLum <= minLum || (minLum < 5 && maxLum > 250)) return;

        const range = maxLum - minLum;
        const scale = 255 / range;

        for (let i = 0; i < d.length; i += 4) {
            d[i]     = Math.min(255, Math.max(0, (d[i] - minLum) * scale));
            d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - minLum) * scale));
            d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - minLum) * scale));
        }
    }

    applySharpenKernel(imgData, width, height, amount = 0.35) {
        const src = imgData.data;
        const output = new ImageData(new Uint8ClampedArray(src), width, height);
        const dst = output.data;

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
                dst[idx + 3] = src[idx + 3];
            }
        }
        return output;
    }

    /**
     * Menerapkan 8 filter visual transformatif & dramatis ke Canvas
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
            case 'smooth_glow':
                this.applyHaruGlow(ctx, destCanvas, imgData);
                return destCanvas;

            case 'noir_contrast':
                for (let i = 0; i < d.length; i += 4) {
                    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    gray = (gray - 128) * 1.55 + 128;
                    gray = Math.min(255, Math.max(0, gray));
                    d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
                }
                break;

            case 'vintage_film':
                for (let i = 0; i < d.length; i += 4) {
                    let r = d[i], g = d[i + 1], b = d[i + 2];
                    r = Math.min(255, r * 1.15 + 18);
                    g = Math.min(255, g * 1.05 + 10);
                    b = Math.max(22, b * 0.82 + 12);
                    d[i] = r; d[i + 1] = g; d[i + 2] = b;
                }
                break;

            case 'korean_pastel':
                for (let i = 0; i < d.length; i += 4) {
                    let r = d[i], g = d[i + 1], b = d[i + 2];
                    r = Math.min(255, r * 1.08 + 24);
                    g = Math.min(255, g * 0.98 + 14);
                    b = Math.min(255, b * 0.95 + 28);
                    d[i] = r; d[i + 1] = g; d[i + 2] = b;
                }
                break;

            case 'cinematic_teal':
                for (let i = 0; i < d.length; i += 4) {
                    let r = d[i], g = d[i + 1], b = d[i + 2];
                    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    if (lum < 128) {
                        r = Math.max(0, r * 0.78);
                        g = Math.min(255, g * 1.08 + 6);
                        b = Math.min(255, b * 1.35 + 16);
                    } else {
                        r = Math.min(255, r * 1.25 + 12);
                        g = Math.min(255, g * 1.05 + 4);
                        b = Math.max(0, b * 0.82);
                    }
                    d[i] = r; d[i + 1] = g; d[i + 2] = b;
                }
                break;

            case 'retro_90s':
                for (let i = 0; i < d.length; i += 4) {
                    let r = d[i], g = d[i + 1], b = d[i + 2];
                    r = (r - 128) * 1.25 + 138;
                    g = (g - 128) * 1.18 + 128;
                    b = (b - 128) * 1.05 + 110;
                    d[i]     = Math.min(255, Math.max(0, r));
                    d[i + 1] = Math.min(255, Math.max(0, g));
                    d[i + 2] = Math.min(255, Math.max(0, b));
                }
                break;

            case 'cyber_vivid':
                for (let i = 0; i < d.length; i += 4) {
                    let r = d[i], g = d[i + 1], b = d[i + 2];
                    r = (r - 128) * 1.45 + 132;
                    g = (g - 128) * 1.35 + 125;
                    b = (b - 128) * 1.50 + 140;
                    d[i]     = Math.min(255, Math.max(0, r));
                    d[i + 1] = Math.min(255, Math.max(0, g));
                    d[i + 2] = Math.min(255, Math.max(0, b));
                }
                break;

            case 'sepia':
                for (let i = 0; i < d.length; i += 4) {
                    const r = d[i], g = d[i + 1], b = d[i + 2];
                    d[i]     = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189) + 12);
                    d[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168) + 6);
                    d[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;
        }

        ctx.putImageData(imgData, 0, 0);
        return destCanvas;
    }

    applyHaruGlow(ctx, canvas, imgData) {
        const d = imgData.data;
        const w = canvas.width;
        const h = canvas.height;
        const orig = new Uint8ClampedArray(d);

        for (let y = 1; y < h - 1; y += 2) {
            for (let x = 1; x < w - 1; x += 2) {
                const idx = (y * w + x) * 4;
                const r = orig[idx], g = orig[idx + 1], b = orig[idx + 2];
                const isSkin = (r > 90 && g > 35 && b > 20 && Math.abs(r - g) > 12 && r > g && r > b);
                if (isSkin) {
                    let avgR = 0, avgG = 0, avgB = 0, cnt = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const n = ((y + dy) * w + (x + dx)) * 4;
                            avgR += orig[n]; avgG += orig[n + 1]; avgB += orig[n + 2]; cnt++;
                        }
                    }
                    d[idx]     = (r * 0.35) + ((avgR / cnt) * 0.65);
                    d[idx + 1] = (g * 0.35) + ((avgG / cnt) * 0.65);
                    d[idx + 2] = (b * 0.35) + ((avgB / cnt) * 0.65);
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.22;
        ctx.filter = 'blur(10px) brightness(1.2)';
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();
    }

    /**
     * Membangun Kolase Komposisi HD (Single, 2x1, 2x2, 3x1)
     */
    composeCollage({
        photoCanvases,
        layoutMode = 'single',
        themeKey = 'white',
        dateString = '',
        frameStyle = 'solid', // 'solid', 'rounded', 'washi_tape', 'film_strip', 'double_border', 'floating_shadow'
        targetDPI = 300
    }) {
        const theme = this.frameThemes[themeKey] || this.frameThemes.white;
        const count = photoCanvases.length;

        let canvasW = 1200;
        let canvasH = 1800;
        let cols = 1;
        let rows = 1;

        if (layoutMode === 'single') {
            const first = photoCanvases[0];
            if (first && first.width > first.height) {
                // Orientasi Lanskap (Mendatar)
                canvasW = 1800;
                canvasH = 1350;
            } else {
                // Orientasi Potret (Tegak)
                canvasW = 1200;
                canvasH = 1800;
            }
        } else if (layoutMode === 'collage_2x1') {
            cols = 1; rows = 2;
            canvasW = 800; canvasH = 1600;
        } else if (layoutMode === 'collage_2x2') {
            cols = 2; rows = 2;
            canvasW = 1400; canvasH = 1750;
        } else if (layoutMode === 'collage_3x1') {
            cols = 1; rows = 3;
            canvasW = 750; canvasH = 1800;
        }

        const outCanvas = document.createElement('canvas');
        outCanvas.width = canvasW;
        outCanvas.height = canvasH;
        const ctx = outCanvas.getContext('2d');

        // 1. Gambar latar belakang bingkai warna solid bersih
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, canvasW, canvasH);

        // 2. Margin & Gutter
        const outerMargin = Math.round(canvasW * 0.055);
        const gutter = Math.round(canvasW * 0.028);
        const footerHeight = Math.round(canvasH * 0.11);

        const availableW = canvasW - (outerMargin * 2) - (gutter * (cols - 1));
        const availableH = canvasH - (outerMargin * 2) - footerHeight - (gutter * (rows - 1));

        const cellW = availableW / cols;
        const cellH = availableH / rows;

        // 3. Render setiap sel foto dengan gaya sudut (frameStyle) terpilih
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const photoIdx = (r * cols) + c;
                if (photoIdx >= count) continue;

                const photo = photoCanvases[photoIdx];
                const cellX = outerMargin + c * (cellW + gutter);
                const cellY = outerMargin + r * (cellH + gutter);

                ctx.save();

                // GAYA 1: 3D Floating Shadow (Bayangan Timbul)
                if (frameStyle === 'floating_shadow') {
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
                    ctx.shadowBlur = 24;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 12;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(cellX, cellY, cellW, cellH);
                    ctx.shadowColor = 'transparent';
                }

                // GAYA 2: Curved Korean Style (Sudut Melengkung Halus)
                if (frameStyle === 'rounded') {
                    this.roundRect(ctx, cellX, cellY, cellW, cellH, 26);
                    ctx.clip();
                } else if (frameStyle === 'solid' || frameStyle === 'double_border' || frameStyle === 'washi_tape' || frameStyle === 'film_strip') {
                    ctx.beginPath();
                    ctx.rect(cellX, cellY, cellW, cellH);
                    ctx.clip();
                }

                this.drawImageCover(ctx, photo, cellX, cellY, cellW, cellH);
                ctx.restore();

                // DEKORASI GAYA LANJUTAN:
                if (frameStyle === 'double_border') {
                    ctx.strokeStyle = theme.border || '#18181B';
                    ctx.lineWidth = 2.5;
                    ctx.strokeRect(cellX - 4, cellY - 4, cellW + 8, cellH + 8);
                    ctx.lineWidth = 1;
                    ctx.strokeRect(cellX - 8, cellY - 8, cellW + 16, cellH + 16);
                }

                if (frameStyle === 'washi_tape') {
                    this.drawWashiTape(ctx, cellX, cellY, cellW, cellH);
                }

                if (frameStyle === 'film_strip') {
                    this.drawFilmSprockets(ctx, cellX, cellY, cellW, cellH);
                }
            }
        }

        // 4. Render Footer & Watermark Elegan di samping tanggal
        this.renderFooterText(ctx, canvasW, canvasH, footerHeight, theme, dateString);

        return outCanvas;
    }

    /**
     * Menggambar teks branding studio permanen di samping tanggal
     */
    renderFooterText(ctx, canvasW, canvasH, footerHeight, theme, dateString) {
        const footerY = canvasH - (footerHeight * 0.45);
        const activeDate = dateString || new Date().toLocaleDateString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }).replace(/\//g, '.');

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const stampFontSize = Math.max(14, Math.round(canvasW * 0.026));
        ctx.font = `700 ${stampFontSize}px "Plus Jakarta Sans", "Inter", -apple-system, sans-serif`;
        ctx.fillStyle = theme.text;
        ctx.letterSpacing = '3px';
        ctx.fillText(`• ${activeDate} • QXUAN PHOTOBOOTH •`, canvasW / 2, footerY);

        const subFontSize = Math.max(10, Math.round(canvasW * 0.016));
        ctx.font = `500 ${subFontSize}px "Inter", sans-serif`;
        ctx.fillStyle = (theme.bg === '#18181B' || theme.bg === '#09090B' || theme.text === '#FFFFFF')
            ? 'rgba(255, 255, 255, 0.65)' 
            : 'rgba(24, 24, 27, 0.5)';
        ctx.letterSpacing = '2px';
        ctx.fillText(`AUTHENTIC STUDIO ARCHIVE • 300 DPI HD PRINT`, canvasW / 2, footerY + (subFontSize * 2));

        ctx.letterSpacing = '0px';
    }

    drawWashiTape(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 245, 230, 0.72)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;

        const tapeW = Math.round(w * 0.22);
        const tapeH = 22;

        ctx.translate(x + 10, y + 6);
        ctx.rotate(-0.35);
        ctx.fillRect(-tapeW/2, -tapeH/2, tapeW, tapeH);
        ctx.strokeRect(-tapeW/2, -tapeH/2, tapeW, tapeH);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.translate(x + w - 10, y + 6);
        ctx.rotate(0.35);
        ctx.fillRect(-tapeW/2, -tapeH/2, tapeW, tapeH);
        ctx.strokeRect(-tapeW/2, -tapeH/2, tapeW, tapeH);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.restore();
    }

    drawFilmSprockets(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = '#09090B';
        const holeW = 12;
        const holeH = 18;
        const holeRadius = 3;
        const step = 32;

        for (let py = y + 15; py < y + h - 15; py += step) {
            this.roundRect(ctx, x - holeW - 6, py, holeW, holeH, holeRadius);
            ctx.fill();
            this.roundRect(ctx, x + w + 6, py, holeW, holeH, holeRadius);
            ctx.fill();
        }
        ctx.restore();
    }

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
