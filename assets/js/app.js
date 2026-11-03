/**
 * Qxuan Photobooth - Master Application Controller
 * Mengatur alur langkah demi langkah (Stepper UI), Web Audio API synth effects,
 * integrasi kamera WebRTC, live filter studio, Midtrans QRIS gate, dan ekspor cetak HD.
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. STATE MANAGEMENT
    // -------------------------------------------------------------
    const state = {
        currentStep: 1,
        layoutMode: 'single', // 'single', 'collage_2x1', 'collage_2x2', 'collage_3x1'
        aspectRatio: '4:3',   // '1:1', '4:3', '16:9'
        timerSeconds: 3,      // 0, 3, 5, 10
        facingMode: 'user',   // 'user' atau 'environment'
        
        capturedFrames: [],   // Array Canvas mentah yang sudah dipra-proses
        targetCount: 1,
        currentCaptureIdx: 0,
        isCapturingSession: false,
        
        selectedFilter: 'normal',
        selectedTheme: 'white',
        selectedFrameStyle: 'solid',
        customText: 'QXUAN PHOTOBOOTH',

        orderId: null,
        amount: 25000,
        isPaid: false,
        pollingInterval: null,
        
        tempDownloadUrl: null,
        compositeResultCanvas: null
    };

    // -------------------------------------------------------------
    // 2. DOM ELEMENTS
    // -------------------------------------------------------------
    const views = {
        step1: document.getElementById('view-step-1'),
        step2: document.getElementById('view-step-2'),
        step3: document.getElementById('view-step-3'),
        step4: document.getElementById('view-step-4'),
        step5: document.getElementById('view-step-5'),
    };

    const stepDots = {
        1: document.getElementById('step-dot-1'),
        2: document.getElementById('step-dot-2'),
        3: document.getElementById('step-dot-3'),
        4: document.getElementById('step-dot-4'),
        5: document.getElementById('step-dot-5'),
    };

    const videoEl           = document.getElementById('camera-video');
    const viewfinderWrap    = document.getElementById('viewfinder-wrapper');
    const shutterFlash      = document.getElementById('shutter-flash');
    const countdownOverlay  = document.getElementById('countdown-overlay');
    const countdownNumber   = document.getElementById('countdown-number');
    const captureBadge      = document.getElementById('capture-badge');
    const resLabel          = document.getElementById('camera-resolution-label');
    const timerDisplayBadge = document.getElementById('timer-display-badge');

    const compositeCanvas   = document.getElementById('composite-canvas');
    const inputCustomText   = document.getElementById('input-custom-text');

    const qrisContainer     = document.getElementById('qris-image-container');
    const displayOrderId    = document.getElementById('display-order-id');
    const priceDisplay      = document.getElementById('price-display');

    const mobileQrContainer = document.getElementById('mobile-download-qr');
    const printImageEl      = document.getElementById('print-image');

    // Inisialisasi Engine
    const cameraEngine = new CameraManager(videoEl);
    const canvasEngine = new CanvasEngine();

    // -------------------------------------------------------------
    // 3. WEB AUDIO SYNTHESIZER (Tanpa file audio eksternal)
    // -------------------------------------------------------------
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // Beep timer countdown
    function playBeep(pitch = 880, duration = 0.08) {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch, ctx.currentTime);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('[Audio] Synth unavailable:', e);
        }
    }

    // Shutter camera click effect
    function playShutterSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (e) {
            console.warn('[Audio] Shutter sound unavailable:', e);
        }
    }

    // -------------------------------------------------------------
    // 4. STEPPER NAVIGATION CONTROLLER
    // -------------------------------------------------------------
    function setStep(stepNumber) {
        state.currentStep = stepNumber;

        // Tampilkan hanya view yang aktif
        Object.keys(views).forEach(key => {
            const num = parseInt(key.replace('step', ''));
            if (num === stepNumber) {
                views[key].classList.remove('hidden');
            } else {
                views[key].classList.add('hidden');
            }
        });

        // Update badge navigasi di header
        Object.keys(stepDots).forEach(numStr => {
            const num = parseInt(numStr);
            const dot = stepDots[num];
            if (!dot) return;
            if (num === stepNumber) {
                dot.className = 'step-badge px-2.5 py-1 rounded-full bg-studio-900 text-white font-semibold';
            } else if (num < stepNumber) {
                dot.className = 'step-badge px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium';
            } else {
                dot.className = 'step-badge px-2.5 py-1 rounded-full bg-studio-100 text-studio-600';
            }
        });

        // Scroll halus ke atas saat pindah view
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // -------------------------------------------------------------
    // 5. STEP 1: PILIHAN MODE & SELEKSI
    // -------------------------------------------------------------
    // Layout choices
    document.querySelectorAll('.layout-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.layout-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.layoutMode = btn.dataset.layout;
            
            // Hitung target foto per sesi
            if (state.layoutMode === 'single') state.targetCount = 1;
            else if (state.layoutMode === 'collage_2x1') state.targetCount = 2;
            else if (state.layoutMode === 'collage_2x2') state.targetCount = 4;
            else if (state.layoutMode === 'collage_3x1') state.targetCount = 3;
        });
    });

    // Ratio choices
    document.querySelectorAll('.ratio-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ratio-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.aspectRatio = btn.dataset.ratio;
        });
    });

    // Timer choices
    document.querySelectorAll('.timer-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.timer-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.timerSeconds = parseInt(btn.dataset.timer, 10);
            timerDisplayBadge.textContent = state.timerSeconds > 0 ? `${state.timerSeconds}s` : 'Off';
        });
    });

    // Mulai Sesi Foto -> Pindah ke Ruang Kamera
    document.getElementById('btn-start-session').addEventListener('click', async () => {
        setStep(2);
        
        // Sesuaikan aspect ratio container kamera
        viewfinderWrap.className = 'video-viewport w-full rounded-2xl border border-studio-800 shadow-xl overflow-hidden relative bg-black max-h-[68vh]';
        if (state.aspectRatio === '1:1') {
            viewfinderWrap.classList.add('aspect-square', 'max-w-md', 'mx-auto');
        } else if (state.aspectRatio === '16:9') {
            viewfinderWrap.classList.add('aspect-[16/9]');
        } else {
            viewfinderWrap.classList.add('aspect-[4/3]');
        }

        // Reset buffer foto sesi ini
        state.capturedFrames = [];
        state.currentCaptureIdx = 0;
        updateCaptureBadge();

        // Mulai kamera WebRTC
        const camResult = await cameraEngine.startCamera(state.facingMode);
        if (camResult.success) {
            resLabel.textContent = `Resolusi Kamera: ${camResult.resolution.width}x${camResult.resolution.height}`;
        } else {
            alert('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser Anda.');
        }
    });

    // Kembali ke Setup dari Kamera
    document.getElementById('btn-back-to-setup').addEventListener('click', () => {
        cameraEngine.stopCamera();
        setStep(1);
    });

    // Tombol Balik Kamera (Depan / Belakang)
    document.getElementById('btn-switch-camera').addEventListener('click', async () => {
        const result = await cameraEngine.switchCamera();
        if (result.success) {
            state.facingMode = result.facingMode;
            resLabel.textContent = `Resolusi: ${result.resolution.width}x${result.resolution.height}`;
        }
    });

    // -------------------------------------------------------------
    // 6. STEP 2: PROSES PENGAMBILAN FOTO (MULTI-SHOT COUNTDOWN)
    // -------------------------------------------------------------
    function updateCaptureBadge() {
        captureBadge.textContent = `Foto ${state.currentCaptureIdx + 1} dari ${state.targetCount}`;
    }

    const btnTriggerShutter = document.getElementById('btn-trigger-shutter');
    btnTriggerShutter.addEventListener('click', () => {
        if (state.isCapturingSession) return;
        executePhotoCaptureSequence();
    });

    async function executePhotoCaptureSequence() {
        state.isCapturingSession = true;
        btnTriggerShutter.disabled = true;

        const timerDuration = state.timerSeconds;

        if (timerDuration > 0) {
            countdownOverlay.classList.remove('hidden');
            for (let sec = timerDuration; sec > 0; sec--) {
                countdownNumber.textContent = sec;
                playBeep(sec === 1 ? 1100 : 700, 0.1);
                await sleep(1000);
            }
            countdownOverlay.classList.add('hidden');
        }

        // Efek Flash Layar & Shutter Sound
        shutterFlash.classList.add('flash-active');
        playShutterSound();
        setTimeout(() => shutterFlash.classList.remove('flash-active'), 450);

        // Ambil frame kamera mentah
        const rawFrame = cameraEngine.captureFrame(state.aspectRatio);

        // Terapkan pra-pemrosesan: Auto-Contrast & Sharpening
        const enhancedFrame = canvasEngine.enhanceRawCapture(rawFrame);
        state.capturedFrames.push(enhancedFrame);
        state.currentCaptureIdx++;

        // Jika masih ada sisa foto dalam mode kolase
        if (state.currentCaptureIdx < state.targetCount) {
            updateCaptureBadge();
            // Jeda istirahat 1.8 detik sebelum giliran foto berikutnya
            await sleep(1800);
            state.isCapturingSession = false;
            btnTriggerShutter.disabled = false;

            // Jika timer otomatis aktif, lanjut hitung mundur berikutnya
            if (state.timerSeconds > 0) {
                executePhotoCaptureSequence();
            }
        } else {
            // Selesai seluruh jepretan sesi!
            cameraEngine.stopCamera();
            state.isCapturingSession = false;
            btnTriggerShutter.disabled = false;
            
            // Masuk ke Studio Editor
            setStep(3);
            renderStudioComposite();
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // -------------------------------------------------------------
    // 7. STEP 3: STUDIO EDITOR & CUSTOMIZATION
    // -------------------------------------------------------------
    function renderStudioComposite() {
        if (!state.capturedFrames.length) return;

        // Terapkan filter visual terpilih ke setiap jepretan foto
        const filteredFrames = state.capturedFrames.map(frame => {
            return canvasEngine.applyFilter(frame, state.selectedFilter);
        });

        // Buat kolase HD
        const outCanvas = canvasEngine.composeCollage({
            photoCanvases: filteredFrames,
            layoutMode: state.layoutMode,
            themeKey: state.selectedTheme,
            customText: state.customText,
            frameStyle: state.selectedFrameStyle,
            targetDPI: 300
        });

        state.compositeResultCanvas = outCanvas;

        // Salin ke canvas preview di layar
        compositeCanvas.width = outCanvas.width;
        compositeCanvas.height = outCanvas.height;
        const ctx = compositeCanvas.getContext('2d');
        ctx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        ctx.drawImage(outCanvas, 0, 0);
    }

    // Filter choices
    document.querySelectorAll('.filter-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedFilter = btn.dataset.filter;
            renderStudioComposite();
        });
    });

    // Theme swatches
    document.querySelectorAll('.theme-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedTheme = btn.dataset.theme;
            renderStudioComposite();
        });
    });

    // Frame style (Solid / Rounded)
    document.querySelectorAll('.framestyle-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.framestyle-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedFrameStyle = btn.dataset.framestyle;
            renderStudioComposite();
        });
    });

    // Custom watermark text
    inputCustomText.addEventListener('input', (e) => {
        state.customText = e.target.value.trim() || 'QXUAN PHOTOBOOTH';
        renderStudioComposite();
    });

    // Foto Ulang (Retake)
    document.getElementById('btn-retake').addEventListener('click', async () => {
        if (confirm('Ulangi sesi foto dari awal? Foto saat ini tidak akan disimpan.')) {
            setStep(2);
            state.capturedFrames = [];
            state.currentCaptureIdx = 0;
            updateCaptureBadge();
            await cameraEngine.startCamera(state.facingMode);
        }
    });

    // Lanjut ke Pembayaran QRIS
    document.getElementById('btn-proceed-payment').addEventListener('click', async () => {
        setStep(4);
        await initMidtransQRIS();
    });

    // -------------------------------------------------------------
    // 8. STEP 4: MIDTRANS DYNAMIC QRIS GATEWAY
    // -------------------------------------------------------------
    async function initMidtransQRIS() {
        qrisContainer.innerHTML = `
            <div class="text-center p-6 space-y-2">
                <div class="w-8 h-8 border-2 border-studio-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p class="text-xs text-studio-400">Menghubungkan ke Midtrans QRIS API...</p>
            </div>
        `;

        try {
            const resp = await fetch('api/create_payment.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    layout_mode: state.layoutMode,
                    aspect_ratio: state.aspectRatio,
                    filter: state.selectedFilter,
                    amount: state.amount
                })
            });

            const res = await resp.json();
            if (res.success && res.data) {
                state.orderId = res.data.order_id;
                displayOrderId.textContent = state.orderId;
                priceDisplay.textContent = `Rp ${Number(res.data.amount).toLocaleString('id-ID')}`;

                // Tampilkan QR Code (Prioritas: SVG dari qr_string atau Image URL)
                renderQRISCode(res.data);

                // Mulai polling status pembayaran
                startPaymentPolling(state.orderId);
            } else {
                qrisContainer.innerHTML = `
                    <div class="text-center p-4 text-red-500 text-xs">
                        Gagal membuat QRIS: ${res.message || 'Kesalahan Server'}
                    </div>
                `;
            }
        } catch (err) {
            console.error('[Payment Error]', err);
            qrisContainer.innerHTML = `
                <div class="text-center p-4 text-red-500 text-xs">
                    Gagal menghubungi backend API. Periksa koneksi PHP server.
                </div>
            `;
        }
    }

    function renderQRISCode(data) {
        if (data.qr_string && window.QRCodeGenerator) {
            try {
                const svgString = window.QRCodeGenerator.renderSVG(data.qr_string, 240);
                qrisContainer.innerHTML = svgString;
                return;
            } catch (e) {
                console.warn('[QR Generator Fallback]', e);
            }
        }

        if (data.qris_url) {
            qrisContainer.innerHTML = `<img src="${data.qris_url}" alt="Midtrans QRIS" class="w-56 h-56 object-contain rounded-xl p-1 bg-white border border-studio-200">`;
        }
    }

    // Polling status setiap 2.5 detik
    function startPaymentPolling(orderId) {
        if (state.pollingInterval) clearInterval(state.pollingInterval);

        state.pollingInterval = setInterval(async () => {
            try {
                const resp = await fetch(`api/check_status.php?order_id=${encodeURIComponent(orderId)}`);
                const res = await resp.json();

                if (res.success && res.data && res.data.is_paid) {
                    clearInterval(state.pollingInterval);
                    state.isPaid = true;
                    handlePaymentSuccess();
                }
            } catch (e) {
                console.warn('[Polling Error]', e);
            }
        }, 2500);
    }

    // Tombol Simulasi Pembayaran Sukses (Mode Sandbox / Dev Testing)
    document.getElementById('btn-simulate-payment').addEventListener('click', async () => {
        if (!state.orderId) return;
        try {
            const resp = await fetch('api/mock_pay.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: state.orderId })
            });
            const res = await resp.json();
            if (res.success) {
                if (state.pollingInterval) clearInterval(state.pollingInterval);
                state.isPaid = true;
                handlePaymentSuccess();
            } else {
                alert('Gagal simulasi: ' + res.message);
            }
        } catch (err) {
            console.error('[Simulate Error]', err);
        }
    });

    // -------------------------------------------------------------
    // 9. STEP 5: PROSES SETELAH BAYAR (PRINT & EXPORT HD)
    // -------------------------------------------------------------
    async function handlePaymentSuccess() {
        setStep(5);

        // Siapkan gambar untuk window.print()
        const hdDataUrl = state.compositeResultCanvas.toDataURL('image/png');
        printImageEl.src = hdDataUrl;

        // Unggah otomatis ke temporary cloud storage (dengan TTL 24 jam)
        uploadTemporaryCloud(hdDataUrl);
    }

    async function uploadTemporaryCloud(dataUrl) {
        mobileQrContainer.innerHTML = `
            <div class="text-center p-2">
                <div class="w-5 h-5 border-2 border-studio-900 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                <span class="text-[9px] text-studio-400">Menyimpan cloud (TTL 24h)...</span>
            </div>
        `;

        try {
            const resp = await fetch('api/upload_temp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_data: dataUrl,
                    order_id: state.orderId,
                    format: 'png'
                })
            });

            const res = await resp.json();
            if (res.success && res.data && res.data.download_url) {
                state.tempDownloadUrl = res.data.download_url;

                // Tampilkan QR Code untuk Mobile Scan
                if (window.QRCodeGenerator) {
                    const qrSvg = window.QRCodeGenerator.renderSVG(state.tempDownloadUrl, 120);
                    mobileQrContainer.innerHTML = qrSvg;
                } else {
                    mobileQrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(state.tempDownloadUrl)}" class="w-28 h-28 object-contain">`;
                }
            } else {
                mobileQrContainer.innerHTML = `<span class="text-[9px] text-red-500 text-center px-1">Gagal upload cloud</span>`;
            }
        } catch (err) {
            console.error('[Cloud Upload Error]', err);
            mobileQrContainer.innerHTML = `<span class="text-[9px] text-stone-400 text-center px-1">Koneksi offline</span>`;
        }
    }

    // Aksi Print
    document.getElementById('btn-print-action').addEventListener('click', () => {
        window.print();
    });

    // Aksi Download Langsung
    document.getElementById('btn-download-png').addEventListener('click', () => {
        triggerDownload(state.compositeResultCanvas.toDataURL('image/png'), 'QXUAN-PHOTOBOOTH.png');
    });

    document.getElementById('btn-download-jpg').addEventListener('click', () => {
        triggerDownload(state.compositeResultCanvas.toDataURL('image/jpeg', 0.92), 'QXUAN-PHOTOBOOTH.jpg');
    });

    document.getElementById('btn-download-webp').addEventListener('click', () => {
        triggerDownload(state.compositeResultCanvas.toDataURL('image/webp', 0.92), 'QXUAN-PHOTOBOOTH.webp');
    });

    function triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Reset Selesai Sesi Baru
    document.getElementById('btn-new-session').addEventListener('click', () => {
        if (confirm('Selesaikan sesi dan kembali ke menu awal untuk pelanggan berikutnya?')) {
            window.location.reload();
        }
    });

    // -------------------------------------------------------------
    // 10. FULLSCREEN KIOSK MODE TOGGLE
    // -------------------------------------------------------------
    const btnFullscreen = document.getElementById('btn-fullscreen');
    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('[Fullscreen] Gagal masuk mode layar penuh:', err);
            });
        } else {
            document.exitFullscreen();
        }
    });
});

