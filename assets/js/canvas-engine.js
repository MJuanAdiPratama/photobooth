/**
 * Qxuan Photobooth - Canvas Core Engine
 * Arsitektur Render 4-Layer:
 * Layer 1: Latar Belakang (Warna dasar & tekstur)
 * Layer 2: Foto-foto Jepretan (dengan Efek Warna Instagram)
 * Layer 3: Overlay Bingkai Transparan (Polos, Polaroid, Bioskop, Batik, Karakter)
 * Layer 4: Teks dan Stiker Tambahan
 */

class CanvasEngine {
    constructor() {
        // Preset Efek Warna Instagram (CSS Filter Matrix)
        this.colorEffects = {
            'normal':   { name: 'Normal',       filter: 'none' },
            'vintage':  { name: 'Vintage',      filter: 'sepia(0.4) contrast(1.2) brightness(0.9) saturate(1.3)' },
            'bw':       { name: 'Hitam Putih',  filter: 'grayscale(1) contrast(1.3)' },
            'warm':     { name: 'Hangat',       filter: 'sepia(0.25) saturate(1.4) brightness(1.05)' },
            'cool':     { name: 'Sejuk',        filter: 'hue-rotate(180deg) sepia(0.15) saturate(1.1)' },
            'dramatic': { name: 'Dramatis',     filter: 'contrast(1.5) saturate(1.2) brightness(0.9)' },
            'soft':     { name: 'Soft',         filter: 'brightness(1.15) contrast(0.9) saturate(0.9)' },
            'retro':    { name: 'Retro',        filter: 'sepia(0.5) hue-rotate(-30deg) contrast(1.1)' }
        };

        // Tema Bingkai per Kategori (Polos, Polaroid, Bioskop, Batik, Karakter)
        this.frameThemes = {
            // 1. Polos (Warna dasar & Pastel)
            'polos_putih':    { category: 'polos', name: 'Putih', bg: '#FFFFFF', text: '#18181B', border: '#E4E4E7' },
            'polos_hitam':    { category: 'polos', name: 'Hitam', bg: '#18181B', text: '#FFFFFF', border: '#27272A' },
            'polos_pink':     { category: 'polos', name: 'Pastel Pink', bg: '#FDE2E4', text: '#5E3038', border: '#FAC1C6' },
            'polos_biru':     { category: 'polos', name: 'Pastel Biru', bg: '#DBEAFE', text: '#1E3A8A', border: '#BFDBFE' },
            'polos_krem':     { category: 'polos', name: 'Pastel Krem', bg: '#FEF3C7', text: '#78350F', border: '#FDE68A' },
            'polos_sage':     { category: 'polos', name: 'Pastel Sage', bg: '#D1FAE5', text: '#064E3B', border: '#A7F3D0' },
            'polos_lavender': { category: 'polos', name: 'Pastel Lavender', bg: '#EDE9FE', text: '#4C1D95', border: '#DDD6FE' },

            // 2. Polaroid (Gaya kertas Instax dengan area teks di bawah)
            'polaroid_klasik':  { category: 'polaroid', name: 'Polaroid Klasik', bg: '#FDFBF7', text: '#1F2937', border: '#E5E7EB', type: 'classic' },
            'polaroid_vintage': { category: 'polaroid', name: 'Polaroid Vintage', bg: '#F6F1E9', text: '#4A3E3D', border: '#D5C7B6', type: 'vintage' },

            // 3. Bioskop (Mall Photobooth Aesthetic Rol Film 35mm)
            'bioskop_35mm':     { category: 'bioskop', name: 'Rol Film 35mm', bg: '#0A0A0C', text: '#FBBF24', border: '#F59E0B', type: 'film35' },
            'bioskop_premiere': { category: 'bioskop', name: 'Tiket Bioskop', bg: '#1C1917', text: '#FDE047', border: '#CA8A04', type: 'premiere' },

            // 4. Batik (Overlay motif batik khas Indonesia)
            'batik_parang':     { category: 'batik', name: 'Batik Parang', bg: '#1E1B18', text: '#D4AF37', border: '#B8860B', type: 'parang' },
            'batik_kawung':     { category: 'batik', name: 'Batik Kawung', bg: '#FAF8F5', text: '#78350F', border: '#B45309', type: 'kawung' },

            // 5. Karakter (Overlay ilustrasi pojok bingkai ala photobooth mall)
            'karakter_cute':    { category: 'karakter', name: 'Y2K Star & Bear', bg: '#FFF0F5', text: '#BE185D', border: '#F472B6', type: 'cute' },
            'karakter_ribbon':  { category: 'karakter', name: 'Pita & Sparkle', bg: '#F5F3FF', text: '#6D28D9', border: '#A78BFA', type: 'ribbon' }
        };
    }

    /**
     * Menerapkan pra-pemrosesan otomatis: Sharpening kernel & Auto-Contrast
     */
    enhanceRawCapture(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        this.applyAutoContrast(imgData);

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

    applySharpenKernel(imgData, width, height, amount = 0.3) {
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
     * Menerapkan Efek Warna Instagram ke Canvas Foto
     */
    applyColorFilter(sourceCanvas, effectKey = 'normal') {
        const dest = document.createElement('canvas');
        dest.width = sourceCanvas.width;
        dest.height = sourceCanvas.height;
        const ctx = dest.getContext('2d');

        const effect = this.colorEffects[effectKey] || this.colorEffects.normal;

        if (effect.filter && effect.filter !== 'none') {
            ctx.filter = effect.filter;
        }

        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.filter = 'none';

        return dest;
    }

    /**
     * Kompilasi 4-Layer Render:
     * Layer 1: Latar Belakang
     * Layer 2: Foto-foto Jepretan (dengan filter)
     * Layer 3: Overlay Bingkai Transparan
     * Layer 4: Teks dan Stiker Tambahan
     */
    composeCollage({
        photoCanvases,
        layoutMode = 'single',
        themeKey = 'polos_putih',
        colorEffectKey = 'normal',
        customText = '',
        stickers = []
    }) {
        const theme = this.frameThemes[themeKey] || this.frameThemes.polos_putih;
        const count = photoCanvases.length;

        // Tentukan resolusi kanvas berdasarkan tata letak
        let canvasW = 1200;
        let canvasH = 1800;
        let cols = 1;
        let rows = 1;

        if (layoutMode === 'single') {
            const first = photoCanvases[0];
            if (first && first.width > first.height) {
                canvasW = 1800;
                canvasH = 1350;
            } else {
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

        // Margin & Gutter
        const isPolaroid = theme.category === 'polaroid';
        const isFilm = theme.category === 'bioskop';

        const outerMargin = isFilm ? Math.round(canvasW * 0.08) : Math.round(canvasW * 0.055);
        const gutter = Math.round(canvasW * 0.028);
        const footerHeight = isPolaroid ? Math.round(canvasH * 0.17) : Math.round(canvasH * 0.11);

        const availableW = canvasW - (outerMargin * 2) - (gutter * (cols - 1));
        const availableH = canvasH - (outerMargin * 2) - footerHeight - (gutter * (rows - 1));

        const cellW = availableW / cols;
        const cellH = availableH / rows;

        // =====================================================================
        // LAYER 1: LATAR BELAKANG
        // =====================================================================
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, canvasW, canvasH);

        if (isPolaroid) {
            // Tekstur halus kertas polaroid
            ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
            ctx.fillRect(0, 0, canvasW, canvasH);
        }

        // =====================================================================
        // LAYER 2: FOTO-FOTO JEPRETAN (DENGAN EFEK WARNA INSTAGRAM)
        // =====================================================================
        const cellBoxes = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const photoIdx = (r * cols) + c;
                if (photoIdx >= count) continue;

                const photo = photoCanvases[photoIdx];
                const cellX = outerMargin + c * (cellW + gutter);
                const cellY = outerMargin + r * (cellH + gutter);

                cellBoxes.push({ x: cellX, y: cellY, w: cellW, h: cellH });

                // Gambar foto
                ctx.save();
                if (theme.category === 'polaroid') {
                    // Halus rounded untuk polaroid window
                    this.roundRect(ctx, cellX, cellY, cellW, cellH, 6);
                    ctx.clip();
                } else if (theme.category === 'karakter') {
                    this.roundRect(ctx, cellX, cellY, cellW, cellH, 16);
                    ctx.clip();
                } else {
                    ctx.beginPath();
                    ctx.rect(cellX, cellY, cellW, cellH);
                    ctx.clip();
                }

                this.drawImageCover(ctx, photo, cellX, cellY, cellW, cellH);
                ctx.restore();
            }
        }

        // =====================================================================
        // LAYER 3: OVERLAY BINGKAI TRANSPARAN (DI ATAS FOTO)
        // =====================================================================
        this.renderFrameOverlay(ctx, canvasW, canvasH, cellBoxes, theme);

        // =====================================================================
        // LAYER 4: TEKS ATAU STIKER TAMBAHAN
        // =====================================================================
        this.renderDecorationsAndText(ctx, canvasW, canvasH, footerHeight, theme, customText, stickers);

        return outCanvas;
    }

    /**
     * Layer 3: Render Overlay Bingkai Transparan
     */
    renderFrameOverlay(ctx, canvasW, canvasH, cellBoxes, theme) {
        ctx.save();

        if (theme.category === 'polos') {
            // Bingkai Garis Minimalis Bersih
            ctx.strokeStyle = theme.border || '#E4E4E7';
            ctx.lineWidth = Math.max(2, Math.round(canvasW * 0.003));
            cellBoxes.forEach(box => {
                ctx.strokeRect(box.x - 1, box.y - 1, box.w + 2, box.h + 2);
            });
        } else if (theme.category === 'polaroid') {
            // Efek Kertas Polaroid Instax: Bayangan tepi sel & garis pembatas
            cellBoxes.forEach(box => {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
                ctx.lineWidth = 2;
                this.roundRect(ctx, box.x, box.y, box.w, box.h, 6);
                ctx.stroke();

                // Garis aksen polaroid vintage jika ada
                if (theme.type === 'vintage') {
                    ctx.strokeStyle = 'rgba(120, 80, 40, 0.15)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(box.x + 3, box.y + 3, box.w - 6, box.h - 6);
                }
            });
        } else if (theme.category === 'bioskop') {
            // Rol Film 35mm Bioskop Mall Photobooth Aesthetic
            this.renderFilmOverlay(ctx, canvasW, canvasH, cellBoxes, theme);
        } else if (theme.category === 'batik') {
            // Motif Batik Tradisional Elegan di Pinggiran Foto
            this.renderBatikOverlay(ctx, canvasW, canvasH, cellBoxes, theme);
        } else if (theme.category === 'karakter') {
            // Ilustrasi Karakter & Doodle di Pojok Bingkai
            this.renderKarakterOverlay(ctx, canvasW, canvasH, cellBoxes, theme);
        }

        ctx.restore();
    }

    /**
     * Overlay Bioskop: Rol Film 35mm dengan lubang sprocket dan timecode
     */
    renderFilmOverlay(ctx, canvasW, canvasH, cellBoxes, theme) {
        ctx.save();

        const holeW = Math.round(canvasW * 0.024);
        const holeH = Math.round(canvasH * 0.018);
        const holeRadius = 3;
        const step = Math.round(canvasH * 0.038);

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        // Lubang sprocket kiri dan kanan
        const leftHoleX = Math.round(canvasW * 0.022);
        const rightHoleX = canvasW - leftHoleX - holeW;

        for (let y = Math.round(canvasH * 0.03); y < canvasH - Math.round(canvasH * 0.03); y += step) {
            this.roundRect(ctx, leftHoleX, y, holeW, holeH, holeRadius);
            ctx.fill();
            ctx.stroke();

            this.roundRect(ctx, rightHoleX, y, holeW, holeH, holeRadius);
            ctx.fill();
            ctx.stroke();
        }

        // Teks dan Frame Stamp Bioskop (01A, 02A, 35mm KODAK MOTION)
        ctx.fillStyle = '#FBBF24';
        ctx.font = `700 ${Math.max(10, Math.round(canvasW * 0.016))}px monospace`;
        ctx.textBaseline = 'middle';

        cellBoxes.forEach((box, idx) => {
            // Garis tipis pembatas film
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(box.x, box.y, box.w, box.h);

            // Stamp frame count
            ctx.fillText(`▶ 0${idx + 1}A`, box.x + 8, box.y + box.h + 14);
            ctx.fillText(`35MM FILM`, box.x + box.w - 75, box.y + box.h + 14);
        });

        ctx.restore();
    }

    /**
     * Overlay Batik: Ornamen Batik Parang & Kawung di Pinggiran Foto
     */
    renderBatikOverlay(ctx, canvasW, canvasH, cellBoxes, theme) {
        ctx.save();
        const strokeColor = theme.border || '#D4AF37';

        cellBoxes.forEach(box => {
            // Border luar berornamen
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(box.x - 3, box.y - 3, box.w + 6, box.h + 6);

            // Ornamen sudut batik
            const cornerSize = Math.round(canvasW * 0.035);
            this.drawBatikCorner(ctx, box.x - 3, box.y - 3, cornerSize, strokeColor, 1, 1);
            this.drawBatikCorner(ctx, box.x + box.w + 3, box.y - 3, cornerSize, strokeColor, -1, 1);
            this.drawBatikCorner(ctx, box.x - 3, box.y + box.h + 3, cornerSize, strokeColor, 1, -1);
            this.drawBatikCorner(ctx, box.x + box.w + 3, box.y + box.h + 3, cornerSize, strokeColor, -1, -1);
        });

        ctx.restore();
    }

    drawBatikCorner(ctx, x, y, size, color, dirX, dirY) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + (dirX * size), y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + (dirY * size));
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + (dirX * size * 0.5), y + (dirY * size * 0.5), size * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Overlay Karakter: Ilustrasi Y2K Star, Bear & Deco Ribbon di Pojok Bingkai
     */
    renderKarakterOverlay(ctx, canvasW, canvasH, cellBoxes, theme) {
        ctx.save();

        cellBoxes.forEach(box => {
            // Garis lembut warna pastel
            ctx.strokeStyle = theme.border || '#F472B6';
            ctx.lineWidth = 3;
            this.roundRect(ctx, box.x, box.y, box.w, box.h, 16);
            ctx.stroke();

            // Doodle pojok: Bintang & Sparkles
            const iconSize = Math.round(canvasW * 0.045);
            ctx.font = `${iconSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (theme.type === 'cute') {
                ctx.fillText('⭐', box.x + 18, box.y + 18);
                ctx.fillText('✨', box.x + box.w - 18, box.y + 18);
                ctx.fillText('🐾', box.x + 18, box.y + box.h - 18);
                ctx.fillText('⭐', box.x + box.w - 18, box.y + box.h - 18);
            } else {
                ctx.fillText('🎀', box.x + 20, box.y + 18);
                ctx.fillText('💖', box.x + box.w - 20, box.y + 18);
                ctx.fillText('✨', box.x + 20, box.y + box.h - 18);
                ctx.fillText('🎀', box.x + box.w - 20, box.y + box.h - 18);
            }
        });

        ctx.restore();
    }

    /**
     * Layer 4: Render Teks & Stiker Tambahan
     */
    renderDecorationsAndText(ctx, canvasW, canvasH, footerHeight, theme, customText, stickers) {
        ctx.save();

        // 1. Teks Kustom Pengguna (jika ada)
        if (customText && customText.trim()) {
            const textY = canvasH - (footerHeight * 0.65);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const userFontSize = Math.max(16, Math.round(canvasW * 0.038));
            ctx.font = `600 ${userFontSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;
            ctx.fillStyle = theme.text || '#18181B';
            ctx.fillText(customText.trim(), canvasW / 2, textY);
        }

        // 2. Branding & Tanggal Permanen Studio
        const footerY = canvasH - (footerHeight * 0.3);
        const dateStr = new Date().toLocaleDateString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }).replace(/\//g, '.');

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const stampFontSize = Math.max(11, Math.round(canvasW * 0.022));
        ctx.font = `600 ${stampFontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = theme.text || '#18181B';
        ctx.letterSpacing = '2px';
        ctx.fillText(`• ${dateStr} • QXUAN PHOTOBOOTH •`, canvasW / 2, footerY);
        ctx.letterSpacing = '0px';

        // 3. Stiker Tambahan Pengguna
        if (Array.isArray(stickers) && stickers.length > 0) {
            stickers.forEach(s => {
                ctx.save();
                const stickerSize = Math.round(canvasW * (s.scale || 0.08));
                ctx.font = `${stickerSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Posisi piksel dari persentase kanvas
                const px = s.relX * canvasW;
                const py = s.relY * canvasH;

                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 8;
                ctx.fillText(s.emoji, px, py);
                ctx.restore();
            });
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
