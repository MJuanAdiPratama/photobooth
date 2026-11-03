/**
 * Qxuan Photobooth - Master Application Controller (Expanded Edition)
 * Mengatur alur langkah demi langkah (Stepper UI), Web Audio API synth effects,
 * sistem popup modal & notifikasi kustom (tanpa alert/confirm bawaan browser),
 * integrasi kamera WebRTC 4K, 8 live filter dramatis, tema karakter & klub sepakbola,
 * serta integrasi Midtrans QRIS & Supabase Storage.
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. STATE MANAGEMENT
    // -------------------------------------------------------------
    const state = {
        currentStep: 1,
        layoutMode: 'single', // 'single', 'collage_2x1', 'collage_2x2', 'collage_3x1'
        aspectRatio: '4:3',   // '1:1', '4:3', '16:9'
        orientation: 'portrait', // 'portrait' (tegak) atau 'landscape' (mendatar)
        timerSeconds: 3,      // 0, 3, 5, 10
        facingMode: 'user',   // 'user' atau 'environment'
        
        capturedFrames: [],   // Array Canvas mentah yang sudah dipra-proses
        targetCount: 1,
        currentCaptureIdx: 0,
        isCapturingSession: false,
        
        selectedFilter: 'normal',
        selectedTheme: 'white',
        selectedFrameStyle: 'solid',

        orderId: null,
        amount: 10000,
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

    const qrisContainer     = document.getElementById('qris-image-container');
    const displayOrderId    = document.getElementById('display-order-id');
    const priceDisplay      = document.getElementById('price-display');

    const mobileQrContainer = document.getElementById('mobile-download-qr');
    const printImageEl      = document.getElementById('print-image');

    // Inisialisasi Engine
    const cameraEngine = new CameraManager(videoEl);
    const canvasEngine = new CanvasEngine();

    // -------------------------------------------------------------
    // 3. SISTEM POPUP MODAL NOTIFIKASI & KONFIRMASI (Revisi 1)
    // -------------------------------------------------------------
    function showModal({
        title = 'Informasi',
        message = '',
        type = 'info', // 'info', 'confirm', 'warning', 'success', 'danger'
        confirmText = 'OK',
        cancelText = 'Batal',
        showCancel = false,
        onConfirm = null,
        onCancel = null
    }) {
        const modalContainer = document.getElementById('studio-modal-container');
        const modalTitle = document.getElementById('modal-title');
        const modalMsg = document.getElementById('modal-message');
        const iconWrap = document.getElementById('modal-icon-wrap');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');

        modalTitle.textContent = title;
        modalMsg.textContent = message;

        btnConfirm.textContent = confirmText;
        btnCancel.textContent = cancelText;

        if (showCancel) {
            btnCancel.classList.remove('hidden');
        } else {
            btnCancel.classList.add('hidden');
        }

        // Penataan ikon & tombol berdasarkan jenis tipe
        if (type === 'danger' || type === 'warning') {
            iconWrap.className = 'w-12 h-12 rounded-full mx-auto mb-3.5 flex items-center justify-center bg-amber-100 text-amber-700';
            iconWrap.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
            btnConfirm.className = 'btn-touch flex-1 py-2.5 px-4 rounded-xl bg-studio-900 hover:bg-studio-800 text-white text-xs font-semibold transition shadow-sm';
        } else if (type === 'success') {
            iconWrap.className = 'w-12 h-12 rounded-full mx-auto mb-3.5 flex items-center justify-center bg-emerald-100 text-emerald-700';
            iconWrap.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
            btnConfirm.className = 'btn-touch flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm';
        } else {
            iconWrap.className = 'w-12 h-12 rounded-full mx-auto mb-3.5 flex items-center justify-center bg-studio-100 text-studio-900';
            iconWrap.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
            btnConfirm.className = 'btn-touch flex-1 py-2.5 px-4 rounded-xl bg-studio-900 hover:bg-studio-800 text-white text-xs font-semibold transition shadow-sm';
        }

        const closeModal = () => {
            modalContainer.classList.add('hidden');
        };

        btnConfirm.onclick = () => {
            closeModal();
            if (onConfirm) onConfirm();
        };

        btnCancel.onclick = () => {
            closeModal();
            if (onCancel) onCancel();
        };

        modalContainer.classList.remove('hidden');
    }

    // -------------------------------------------------------------
    // 4. WEB AUDIO SYNTHESIZER (Tanpa file audio eksternal)
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
    // 5. STEPPER NAVIGATION CONTROLLER
    // -------------------------------------------------------------
    function setStep(stepNumber) {
        state.currentStep = stepNumber;

        Object.keys(views).forEach(key => {
            const num = parseInt(key.replace('step', ''));
            if (num === stepNumber) {
                views[key].classList.remove('hidden');
            } else {
                views[key].classList.add('hidden');
            }
        });

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

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // -------------------------------------------------------------
    // 6. STEP 1: PILIHAN MODE & SELEKSI
    // -------------------------------------------------------------
    document.querySelectorAll('.layout-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.layout-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.layoutMode = btn.dataset.layout;
            
            if (state.layoutMode === 'single') state.targetCount = 1;
            else if (state.layoutMode === 'collage_2x1') state.targetCount = 2;
            else if (state.layoutMode === 'collage_2x2') state.targetCount = 4;
            else if (state.layoutMode === 'collage_3x1') state.targetCount = 3;
        });
    });

    // Helper: Update Rasio Aspek Label & Button
    function updateRatioLabels() {
        const labelClassic = document.getElementById('label-ratio-classic');
        const labelWide = document.getElementById('label-ratio-wide');
        const toggleBtnLabel = document.getElementById('orientation-toggle-label');

        if (state.orientation === 'portrait') {
            if (labelClassic) labelClassic.textContent = '3 : 4';
            if (labelWide) labelWide.textContent = '9 : 16';
            if (toggleBtnLabel) toggleBtnLabel.textContent = '📱 Potret';
        } else {
            if (labelClassic) labelClassic.textContent = '4 : 3';
            if (labelWide) labelWide.textContent = '16 : 9';
            if (toggleBtnLabel) toggleBtnLabel.textContent = '💻 Lanskap';
        }
    }

    // Helper: Update Viewfinder Aspect Ratio & Max-Width
    function updateViewfinderDimensions() {
        if (!viewfinderWrap) return;
        const baseClass = 'video-viewport w-full rounded-2xl border border-studio-800 shadow-xl overflow-hidden relative bg-black max-h-[68vh] transition-all duration-300';

        if (state.aspectRatio === '1:1') {
            viewfinderWrap.className = `${baseClass} aspect-square max-w-sm sm:max-w-md mx-auto`;
        } else if (state.orientation === 'portrait') {
            // Mode Potret (Tegak)
            if (state.aspectRatio === '16:9') {
                viewfinderWrap.className = `${baseClass} aspect-[9/16] max-w-xs sm:max-w-sm mx-auto`;
            } else {
                viewfinderWrap.className = `${baseClass} aspect-[3/4] max-w-sm sm:max-w-md mx-auto`;
            }
        } else {
            // Mode Lanskap (Mendatar)
            if (state.aspectRatio === '16:9') {
                viewfinderWrap.className = `${baseClass} aspect-[16/9] max-w-3xl mx-auto`;
            } else {
                viewfinderWrap.className = `${baseClass} aspect-[4/3] max-w-2xl mx-auto`;
            }
        }
    }

    // Orientation Choice Listener (Potret vs Lanskap)
    document.querySelectorAll('.orientation-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.orientation-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.orientation = btn.dataset.orientation;
            updateRatioLabels();
            updateViewfinderDimensions();
        });
    });

    document.querySelectorAll('.ratio-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ratio-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.aspectRatio = btn.dataset.ratio;
        });
    });

    document.querySelectorAll('.timer-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.timer-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.timerSeconds = parseInt(btn.dataset.timer, 10);
            timerDisplayBadge.textContent = state.timerSeconds > 0 ? `${state.timerSeconds}s` : 'Off';
        });
    });

    document.getElementById('btn-start-session').addEventListener('click', async () => {
        setStep(2);
        updateRatioLabels();
        updateViewfinderDimensions();

        state.capturedFrames = [];
        state.currentCaptureIdx = 0;
        updateCaptureBadge();

        const camResult = await cameraEngine.startCamera(state.facingMode);
        if (camResult.success) {
            resLabel.textContent = `Resolusi: ${camResult.resolution.width}x${camResult.resolution.height}`;
        } else {
            showModal({
                title: 'Akses Kamera Terkendala',
                message: 'Tidak dapat mengakses perangkat kamera. Pastikan Anda telah memberikan izin kamera pada peramban (browser) Anda.',
                type: 'warning',
                confirmText: 'Mengerti'
            });
        }
    });

    document.getElementById('btn-back-to-setup').addEventListener('click', () => {
        cameraEngine.stopCamera();
        setStep(1);
    });

    // Toggle Orientasi Cepat di Layar Kamera (Step 2)
    const btnToggleOrientation = document.getElementById('btn-toggle-orientation');
    if (btnToggleOrientation) {
        btnToggleOrientation.addEventListener('click', () => {
            state.orientation = (state.orientation === 'portrait') ? 'landscape' : 'portrait';
            
            // Sinkronkan tombol di Step 1
            document.querySelectorAll('.orientation-choice').forEach(b => {
                b.classList.toggle('active', b.dataset.orientation === state.orientation);
            });

            updateRatioLabels();
            updateViewfinderDimensions();
        });
    }

    document.getElementById('btn-switch-camera').addEventListener('click', async () => {
        const result = await cameraEngine.switchCamera();
        if (result.success) {
            state.facingMode = result.facingMode;
            resLabel.textContent = `Resolusi: ${result.resolution.width}x${result.resolution.height}`;
        }
    });

    // -------------------------------------------------------------
    // 7. STEP 2: PROSES PENGAMBILAN FOTO
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

        shutterFlash.classList.add('flash-active');
        playShutterSound();
        setTimeout(() => shutterFlash.classList.remove('flash-active'), 450);

        const rawFrame = cameraEngine.captureFrame(state.aspectRatio, state.orientation);
        const enhancedFrame = canvasEngine.enhanceRawCapture(rawFrame);
        state.capturedFrames.push(enhancedFrame);
        state.currentCaptureIdx++;

        if (state.currentCaptureIdx < state.targetCount) {
            updateCaptureBadge();
            await sleep(1800);
            state.isCapturingSession = false;
            btnTriggerShutter.disabled = false;

            if (state.timerSeconds > 0) {
                executePhotoCaptureSequence();
            }
        } else {
            cameraEngine.stopCamera();
            state.isCapturingSession = false;
            btnTriggerShutter.disabled = false;
            
            setStep(3);
            renderStudioComposite();
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // -------------------------------------------------------------
    // 8. STEP 3: STUDIO EDITOR & CUSTOMIZATION
    // -------------------------------------------------------------
    function renderStudioComposite() {
        if (!state.capturedFrames.length) return;

        // Terapkan filter visual transformatif terpilih
        const filteredFrames = state.capturedFrames.map(frame => {
            return canvasEngine.applyFilter(frame, state.selectedFilter);
        });

        // Buat kolase HD dengan tema bingkai & gaya sudut terpilih
        const outCanvas = canvasEngine.composeCollage({
            photoCanvases: filteredFrames,
            layoutMode: state.layoutMode,
            themeKey: state.selectedTheme,
            frameStyle: state.selectedFrameStyle,
            targetDPI: 300
        });

        state.compositeResultCanvas = outCanvas;

        compositeCanvas.width = outCanvas.width;
        compositeCanvas.height = outCanvas.height;
        const ctx = compositeCanvas.getContext('2d');
        ctx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        ctx.drawImage(outCanvas, 0, 0);
    }

    // Filter Choice Listener (8 Filter Baru Transformatif)
    document.querySelectorAll('.filter-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedFilter = btn.dataset.filter;
            renderStudioComposite();
        });
    });

    // Theme Choice Listener (24 Pilihan Warna Bingkai Studio)
    document.querySelectorAll('.theme-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedTheme = btn.dataset.theme;
            renderStudioComposite();
        });
    });

    // Frame Style Listener (6 Gaya Sudut Inovatif)
    document.querySelectorAll('.framestyle-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.framestyle-choice').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedFrameStyle = btn.dataset.framestyle;
            renderStudioComposite();
        });
    });

    // Foto Ulang (Retake dengan Popup Modal)
    document.getElementById('btn-retake').addEventListener('click', () => {
        showModal({
            title: 'Ulangi Sesi Foto?',
            message: 'Seluruh jepretan foto di sesi ini akan dihapus dan kamera akan dinyalakan kembali dari foto pertama.',
            type: 'warning',
            showCancel: true,
            confirmText: 'Ya, Ulangi Foto',
            cancelText: 'Batal',
            onConfirm: async () => {
                setStep(2);
                state.capturedFrames = [];
                state.currentCaptureIdx = 0;
                updateCaptureBadge();
                await cameraEngine.startCamera(state.facingMode);
            }
        });
    });

    // Lanjut ke Pembayaran QRIS
    document.getElementById('btn-proceed-payment').addEventListener('click', async () => {
        setStep(4);
        await initMidtransQRIS();
    });

    // -------------------------------------------------------------
    // 9. STEP 4: MIDTRANS DYNAMIC QRIS GATEWAY
    // -------------------------------------------------------------
    async function initMidtransQRIS() {
        qrisContainer.innerHTML = `
            <div class="text-center p-6 space-y-2">
                <div class="w-8 h-8 border-2 border-studio-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p class="text-xs text-studio-400">Menghubungkan ke Midtrans QRIS API...</p>
            </div>
        `;

        try {
            const resp = await fetch('api/create_payment', {
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

                renderQRISCode(res.data);
                startPaymentPolling(state.orderId);
            } else {
                qrisContainer.innerHTML = `
                    <div class="text-center p-4 text-rose-500 text-xs">
                        Gagal membuat QRIS: ${res.message || 'Kesalahan Server'}
                    </div>
                `;
            }
        } catch (err) {
            console.error('[Payment Error]', err);
            qrisContainer.innerHTML = `
                <div class="text-center p-4 text-rose-500 text-xs">
                    Gagal menghubungi backend API. Periksa koneksi server.
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
                const resp = await fetch(`api/check_status?order_id=${encodeURIComponent(orderId)}`);
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
        // Jika belum ada orderId (misal gagal memuat Midtrans), otomatis buat orderId simulasi
        if (!state.orderId) {
            state.orderId = `QXUAN-SIM-${Date.now()}`;
            if (displayOrderId) displayOrderId.textContent = state.orderId;
        }

        const proceedSuccess = () => {
            if (state.pollingInterval) clearInterval(state.pollingInterval);
            state.isPaid = true;
            
            showModal({
                title: 'Pembayaran Terverifikasi!',
                message: 'Simulasi pembayaran sukses berhasil diaktifkan. Tombol Cetak dan Download HD telah dibuka.',
                type: 'success',
                confirmText: 'Buka Foto Saya',
                onConfirm: () => {
                    handlePaymentSuccess();
                }
            });
        };

        try {
            const resp = await fetch('api/mock_pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: state.orderId })
            });
            const res = await resp.json().catch(() => ({}));
            
            if (res.success) {
                proceedSuccess();
            } else {
                console.warn('[Mock Pay Response, applying direct fallback]', res);
                proceedSuccess();
            }
        } catch (err) {
            console.warn('[Simulate Error, applying client-side fallback]', err);
            proceedSuccess();
        }
    });

    // -------------------------------------------------------------
    // 10. STEP 5: PROSES SETELAH BAYAR (PRINT & EXPORT HD)
    // -------------------------------------------------------------
    async function handlePaymentSuccess() {
        setStep(5);

        const hdDataUrl = state.compositeResultCanvas.toDataURL('image/png');
        printImageEl.src = hdDataUrl;

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
            const resp = await fetch('api/upload_temp', {
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

                if (window.QRCodeGenerator) {
                    const qrSvg = window.QRCodeGenerator.renderSVG(state.tempDownloadUrl, 120);
                    mobileQrContainer.innerHTML = qrSvg;
                } else {
                    mobileQrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(state.tempDownloadUrl)}" class="w-28 h-28 object-contain">`;
                }
            } else {
                mobileQrContainer.innerHTML = `<span class="text-[9px] text-rose-500 text-center px-1">Gagal upload cloud</span>`;
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

    // Reset Selesai Sesi Baru (Revisi 1: Muncul Popup Modal Elegan)
    document.getElementById('btn-new-session').addEventListener('click', () => {
        showModal({
            title: 'Selesaikan & Mulai Sesi Baru?',
            message: 'Sesi foto ini akan ditutup dan bilik foto akan direset untuk pelanggan berikutnya. Pastikan Anda sudah mengunduh atau mencetak foto Anda.',
            type: 'confirm',
            showCancel: true,
            confirmText: 'Ya, Selesaikan',
            cancelText: 'Kembali',
            onConfirm: () => {
                window.location.reload();
            }
        });
    });

    // -------------------------------------------------------------
    // 11. FULLSCREEN MODE TOGGLE
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
