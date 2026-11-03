/**
 * Qxuan Photobooth - WebRTC Camera Controller
 * Mengelola stream kamera resolusi tinggi (hingga 4K), pergantian kamera (Depan/Belakang),
 * dan penangkapan frame mentah beresolusi penuh dari sensor perangkat.
 */

class CameraManager {
    constructor(videoElement) {
        this.video = videoElement;
        this.stream = null;
        this.currentFacingMode = 'user'; // 'user' (depan/selfie) atau 'environment' (belakang)
        this.availableDevices = [];
        this.isMirrored = true;
        this.actualResolution = { width: 0, height: 0 };
    }

    /**
     * Memulai stream kamera dengan spesifikasi resolusi ideal 4K
     */
    async startCamera(facingMode = 'user') {
        this.stopCamera();
        this.currentFacingMode = facingMode;
        this.isMirrored = (facingMode === 'user');

        // Update class styling untuk mirroring kamera depan
        if (this.isMirrored) {
            this.video.classList.add('mirror-mode');
        } else {
            this.video.classList.remove('mirror-mode');
        }

        // Constraints sesuai spesifikasi Qxuan Photobooth:
        // Ideal 3840x2160 (4K UHD) dengan fallback otomatis oleh browser ke resolusi terbaik hardware
        const constraints = {
            audio: false,
            video: {
                width: { ideal: 3840, max: 3840 },
                height: { ideal: 2160, max: 2160 },
                facingMode: { ideal: facingMode }
            }
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play().then(resolve);
                };
            });

            // Baca resolusi nyata yang diberikan oleh hardware
            const track = this.stream.getVideoTracks()[0];
            const settings = track.getSettings ? track.getSettings() : {};
            this.actualResolution = {
                width: settings.width || this.video.videoWidth,
                height: settings.height || this.video.videoHeight
            };

            console.log(`[Camera] Terhubung dengan resolusi: ${this.actualResolution.width}x${this.actualResolution.height}`);
            return {
                success: true,
                resolution: this.actualResolution,
                facingMode: this.currentFacingMode
            };
        } catch (error) {
            console.warn('[Camera] Gagal menginisialisasi resolusi 4K ideal, mencoba fallback resolusi standar...', error);
            
            // Fallback constraint standar
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { facingMode: facingMode }
                });
                this.video.srcObject = this.stream;
                await this.video.play();
                this.actualResolution = {
                    width: this.video.videoWidth,
                    height: this.video.videoHeight
                };
                return {
                    success: true,
                    resolution: this.actualResolution,
                    facingMode: this.currentFacingMode
                };
            } catch (fallbackError) {
                console.error('[Camera Error] Tidak dapat mengakses kamera:', fallbackError);
                return {
                    success: false,
                    error: fallbackError.name || 'CameraAccessDenied'
                };
            }
        }
    }

    /**
     * Beralih antara kamera depan dan kamera belakang
     */
    async switchCamera() {
        const nextMode = (this.currentFacingMode === 'user') ? 'environment' : 'user';
        return await this.startCamera(nextMode);
    }

    /**
     * Menangkap frame gambar saat ini dari stream kamera dengan resolusi asli sensor
     * @param {string} targetAspectRatio '1:1', '4:3', '16:9', '3:4', '9:16'
     * @param {string} orientation 'portrait' atau 'landscape'
     */
    captureFrame(targetAspectRatio = '4:3', orientation = 'portrait') {
        if (!this.video || !this.video.videoWidth) {
            throw new Error('Stream video kamera belum siap.');
        }

        const sourceW = this.video.videoWidth;
        const sourceH = this.video.videoHeight;

        // Hitung rasio target numerik berdasarkan Aspect Ratio dan Orientasi (Portrait / Landscape)
        let targetRatioVal = 4 / 3;
        if (targetAspectRatio === '1:1') {
            targetRatioVal = 1;
        } else if (targetAspectRatio === '16:9' || targetAspectRatio === '9:16') {
            targetRatioVal = (orientation === 'portrait') ? (9 / 16) : (16 / 9);
        } else { // '4:3' atau '3:4'
            targetRatioVal = (orientation === 'portrait') ? (3 / 4) : (4 / 3);
        }

        // Hitung crop center agar proporsi sesuai rasio dan orientasi yang dipilih tanpa distorsi stretch
        let cropW = sourceW;
        let cropH = sourceW / targetRatioVal;

        if (cropH > sourceH) {
            cropH = sourceH;
            cropW = sourceH * targetRatioVal;
        }

        const cropX = (sourceW - cropW) / 2;
        const cropY = (sourceH - cropH) / 2;

        // Siapkan offscreen canvas beresolusi tinggi untuk penangkapan
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = Math.round(cropW);
        offscreenCanvas.height = Math.round(cropH);
        const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

        // Terapkan flip horizontal jika kamera depan (mirroring alami)
        if (this.isMirrored) {
            ctx.translate(offscreenCanvas.width, 0);
            ctx.scale(-1, 1);
        }

        // Gambar potongan frame ke canvas
        ctx.drawImage(
            this.video,
            cropX, cropY, cropW, cropH,
            0, 0, offscreenCanvas.width, offscreenCanvas.height
        );

        return offscreenCanvas;
    }

    /**
     * Menghentikan kamera untuk menghemat daya & privasi
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
}

window.CameraManager = CameraManager;

