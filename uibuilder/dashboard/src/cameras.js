document.addEventListener('DOMContentLoaded', () => {
    const cameraConfig = [
        { id: 'cam1', name: 'Front entrance', caption: 'Camera at looking up the entry path', path: 'cam1_high', previewPath: 'cam1_low', enabled: true },
        { id: 'cam2', name: 'Second driveway', caption: 'Looking up to the street, where we park the caravan', path: 'cam2_high', previewPath: 'cam2_low', enabled: true },
        { id: 'cam3', name: 'Camera 3', caption: 'Garage', path: 'cam3_high', previewPath: 'cam3_low', enabled: false },
        { id: 'cam4', name: 'Camera 4', caption: 'Driveway', path: 'cam4_high', previewPath: 'cam4_low', enabled: false },
        { id: 'cam5', name: 'Camera 5', caption: 'Patio', path: 'cam5_high', previewPath: 'cam5_low', enabled: false },
        { id: 'cam6', name: 'Camera 6', caption: 'Courtyard', path: 'cam6_high', previewPath: 'cam6_low', enabled: false },
        { id: 'cam7', name: 'Camera 7', caption: 'Side gate', path: 'cam7_high', previewPath: 'cam7_low', enabled: false },
        { id: 'cam8', name: 'Camera 8', caption: 'Rear entry', path: 'cam8_high', previewPath: 'cam8_low', enabled: false }
    ];

    const activeCameras = cameraConfig.filter((camera) => camera.enabled !== false);
    const cardById = new Map();
    const player = document.getElementById('cameraPlayer');
    const toggleButton = document.getElementById('streamToggle');
    const qualityToggle = document.getElementById('qualityToggle');
    const cameraGrid = document.getElementById('cameraGrid');
    const cameraEmptyState = document.getElementById('cameraEmptyState');
    const statusEl = document.getElementById('connectionStatus');
    const lastUpdateEl = document.getElementById('lastUpdate');
    const state = {
        selectedId: activeCameras[0]?.id || null,
        quality: 'low'
    };
    let activePlayerController = null;
    let streamLoadToken = 0;

    function getCurrentHostUrl(port) {
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        const host = window.location.hostname || '127.0.0.1';
        return `${protocol}://${host}:${port}`;
    }

    function getStreamUrl(camera, quality) {
        const streamPath = quality === 'high' ? camera.path : (camera.previewPath || camera.path);
        return `${getCurrentHostUrl(8888)}/${streamPath}/index.m3u8?cookieCheck=1`;
    }

    function setLastUpdate() {
        const now = new Date();
        lastUpdateEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function updateConnectionStatus() {
        statusEl.className = 'status-indicator online';
        statusEl.innerHTML = '<i class="fas fa-circle"></i> Connected to MediaMTX';
        setLastUpdate();
    }

    function setPlayerState(isPlaying) {
        toggleButton.innerHTML = isPlaying
            ? '<i class="fas fa-pause"></i> Pause'
            : '<i class="fas fa-play"></i> Play';
    }

    function updateQualityToggleUI() {
        if (!qualityToggle) return;
        const isHigh = state.quality === 'high';
        qualityToggle.classList.toggle('high', isHigh);
        qualityToggle.innerHTML = isHigh
            ? '<i class="fas fa-sliders"></i> Quality: High'
            : '<i class="fas fa-sliders"></i> Quality: Low';
    }

    function supportsNativeHls(videoEl) {
        return Boolean(videoEl.canPlayType('application/vnd.apple.mpegurl'));
    }

    function buildVideoController(videoEl, streamUrl, options = {}) {
        const onLoaded = options.onLoaded || (() => {});
        const onError = options.onError || (() => {});
        const autoplay = options.autoplay === true;
        const muted = options.muted === true;

        let cleanedUp = false;
        let hls = null;

        videoEl.muted = muted;
        videoEl.playsInline = true;
        videoEl.preload = 'auto';

        const removeNativeSource = () => {
            videoEl.pause();
            videoEl.removeAttribute('src');
            videoEl.load();
        };

        const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            videoEl.removeEventListener('loadeddata', handleLoadedData);
            videoEl.removeEventListener('error', handleVideoError);
            if (hls) {
                hls.destroy();
                hls = null;
            }
        };

        const handleLoadedData = () => {
            onLoaded();
            if (autoplay) {
                videoEl.play().catch(() => {});
            }
        };

        const handleVideoError = () => {
            onError({ type: 'video-element' });
        };

        videoEl.addEventListener('loadeddata', handleLoadedData);
        videoEl.addEventListener('error', handleVideoError);

        if (supportsNativeHls(videoEl)) {
            videoEl.src = streamUrl;
            videoEl.load();
            if (autoplay) {
                videoEl.play().catch(() => {});
            }
            return {
                dispose() {
                    cleanup();
                    removeNativeSource();
                }
            };
        }

        if (window.Hls && window.Hls.isSupported()) {
            hls = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 30
            });

            hls.on(window.Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(streamUrl);
            });

            hls.on(window.Hls.Events.ERROR, (_, data) => {
                if (data && data.fatal) {
                    onError({
                        type: 'hls',
                        details: data.details,
                        responseCode: data.response && data.response.code ? data.response.code : null
                    });
                    cleanup();
                }
            });

            hls.attachMedia(videoEl);

            return {
                dispose() {
                    cleanup();
                    removeNativeSource();
                }
            };
        }

        setTimeout(() => onError({ type: 'unsupported' }), 0);
        return {
            dispose() {
                cleanup();
            }
        };
    }

    function renderCameraCards() {
        cameraGrid.innerHTML = '';
        cardById.clear();

        activeCameras.forEach((camera, index) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `camera-card${state.selectedId === camera.id ? ' active' : ''}`;
            card.dataset.cameraId = camera.id;
            card.setAttribute('aria-label', `Select ${camera.name}`);

            const metadata = document.createElement('div');
            metadata.className = 'camera-card-body';
            metadata.innerHTML = `
                <div class="camera-meta">
                    <div class="camera-name">${camera.name}</div>
                    <div class="camera-caption">${camera.caption}</div>
                    <div class="camera-number">Camera ${index + 1}</div>
                </div>
                <span class="camera-status-dot" aria-hidden="true"></span>
            `;

            card.appendChild(metadata);
            card.addEventListener('click', () => {
                if (state.selectedId === camera.id) return;
                state.selectedId = camera.id;
                state.quality = 'low';
                updateQualityToggleUI();
                setActiveCard(camera.id);
                loadCamera(camera);
            });

            cameraGrid.appendChild(card);
            cardById.set(camera.id, card);
        });
    }

    function setActiveCard(selectedId) {
        cardById.forEach((card, cameraId) => {
            card.classList.toggle('active', cameraId === selectedId);
        });
    }

    function isRecoverableStreamError(errorInfo) {
        if (!errorInfo || errorInfo.type !== 'hls') return false;
        const detail = errorInfo.details || '';
        const code = errorInfo.responseCode;
        return (
            code === 404 ||
            detail === 'manifestLoadError' ||
            detail === 'manifestLoadTimeOut' ||
            detail === 'levelLoadError' ||
            detail === 'levelLoadTimeOut'
        );
    }

    function loadCamera(camera, attempt = 0, token = null) {
        const currentToken = token || ++streamLoadToken;

        if (currentToken !== streamLoadToken) {
            return;
        }

        if (activePlayerController) {
            activePlayerController.dispose();
            activePlayerController = null;
        }

        cameraEmptyState.style.display = 'none';

        activePlayerController = buildVideoController(
            player,
            getStreamUrl(camera, state.quality),
            {
                autoplay: true,
                muted: false,
                onLoaded: () => {
                    setPlayerState(true);
                    setLastUpdate();
                },
                onError: (errorInfo) => {
                    if (currentToken !== streamLoadToken) return;
                    if (isRecoverableStreamError(errorInfo) && attempt < 4) {
                        window.setTimeout(() => {
                            loadCamera(camera, attempt + 1, currentToken);
                        }, 1200);
                        return;
                    }
                    cameraEmptyState.style.display = 'flex';
                    cameraEmptyState.innerHTML = '<div><i class="fas fa-exclamation-circle"></i><br>Unable to play this stream in the browser</div>';
                    setPlayerState(false);
                }
            }
        );
    }

    toggleButton.addEventListener('click', () => {
        if (!state.selectedId) return;

        if (player.paused) {
            cameraEmptyState.style.display = 'none';
            player.play().catch(() => {
                cameraEmptyState.style.display = 'flex';
                cameraEmptyState.innerHTML = '<div><i class="fas fa-exclamation-circle"></i><br>Stream is unavailable in this browser</div>';
            });
            setPlayerState(true);
        } else {
            player.pause();
            setPlayerState(false);
        }
    });

    qualityToggle.addEventListener('click', () => {
        if (!state.selectedId) return;
        state.quality = state.quality === 'low' ? 'high' : 'low';
        updateQualityToggleUI();
        const selectedCamera = activeCameras.find((camera) => camera.id === state.selectedId);
        if (selectedCamera) {
            loadCamera(selectedCamera);
        }
    });

    player.addEventListener('play', () => setPlayerState(true));
    player.addEventListener('pause', () => setPlayerState(false));

    updateConnectionStatus();
    updateQualityToggleUI();
    renderCameraCards();

    if (state.selectedId) {
        const selectedCamera = activeCameras.find((camera) => camera.id === state.selectedId);
        if (selectedCamera) {
            loadCamera(selectedCamera);
        }
    }
});
