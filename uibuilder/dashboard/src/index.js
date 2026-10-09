// Dashboard JavaScript using uibuilder
/* globals uibuilder */

// Initialize solar widget
let solarWidget;
let selectedPrinterId = null;
const printerCache = {};

// Track recently toggled lights to prevent race condition
const recentlyToggled = new Map();

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function () {
  console.log('Dashboard loaded');
  setupPrinterModalEvents();
  // setTimeout(setupUibuilder(), 1000);
  setTimeout(() => {
    setupUibuilder();
  }, 500);
});

setTimeout(() => {
uibuilder.send({
  topic: 'dashboard',
  payload: 'dashboard'
});
}, 1000);

// Setup uibuilder communication
function setupUibuilder() {
  // Start uibuilder
  uibuilder.start();

  // Handle connection status
  uibuilder.onChange('ioConnected', function (connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (connected) {
      statusEl.className = 'status-indicator online';
      statusEl.innerHTML = '<i class="fas fa-circle"></i> Connected';
    } else {
      statusEl.className = 'status-indicator offline';
      statusEl.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
    }
  });

  // Handle incoming messages
  uibuilder.onChange('msg', function (msg) {
    console.log('Received message:', msg);

    if (msg.topic === 'battery') {
      //updateBattery(msg.payload);
    } else if (msg.topic === 'weather') {
      updateWeather(msg.payload);
    } else if (msg.topic === 'solar') {
      //updateSolarWidget(msg.payload);
    } else if (msg.topic === 'lightsandmowers') {
      updateMowers(msg.payload.mowers);
      updateLights(msg.payload.lights);
      updatePrinters(msg.payload.printers || []);
    }
    
    // Update timestamp
    updateTimestamp();
  });
}

function setupPrinterModalEvents() {
  const modal = document.getElementById('printerModal');
  const modalCard = modal ? modal.querySelector('.printer-modal-card') : null;
  const closeBtn = document.getElementById('printerModalClose');

  if (!modal || !closeBtn) {
    return;
  }

  closeBtn.addEventListener('click', closePrinterModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closePrinterModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePrinterModal();
    }
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDuration(seconds) {
  const sec = Number(seconds);
  if (!Number.isFinite(sec) || sec < 0) {
    return '--';
  }

  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);

  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function updatePrinters(printers) {
  const container = document.getElementById('printerContainer');
  if (!container) return;

  const printerList = Array.isArray(printers) ? printers : [];
  container.innerHTML = '';

  if (printerList.length === 0) {
    container.innerHTML = '<div class="printer-card">No printer data available yet.</div>';
    return;
  }

  printerList.forEach((printer) => {
    if (!printer || !printer.id) return;

    printerCache[printer.id] = printer;

    const statusClass = getPrinterStatusClass(printer);
    const stateText = escapeHtml(printer.state || 'unknown');
    const nozzle = printer.temperatures && printer.temperatures.nozzle !== null && printer.temperatures.nozzle !== undefined
      ? `${Math.round(printer.temperatures.nozzle*10)/10 }°C` : '--';
    const bed = printer.temperatures && printer.temperatures.bed !== null && printer.temperatures.bed !== undefined
      ? `${Math.round(printer.temperatures.bed*10)/10}°C` : '--';
    const nozzleTarget = printer.temperatures && printer.temperatures.nozzletarget !== null && printer.temperatures.nozzleTarget !== undefined && printer.temperatures.nozzleTarget > 0
      ? `/${Math.round(printer.temperatures.nozzletarget*10)/10}°C` : '';
    const bedTarget = printer.temperatures && printer.temperatures.bedtarget !== null && printer.temperatures.bedtarget !== undefined && printer.temperatures.bedtarget > 0
      ? `/${Math.round(printer.temperatures.bedtarget*10)/10}°C` : '';
    const remaining = formatDuration(printer.progress && printer.progress.remainingSec);
    const elapsed = formatDuration(printer.progress && printer.progress.elapsedSec);
    const fileRaw = printer.filename ? String(printer.filename) : '--';
    const fileDisplay = escapeHtml(fileRaw);
    const fileClass = fileRaw.length > 34
      ? ' printer-meta-value-file-xs'
      : fileRaw.length > 26
        ? ' printer-meta-value-file-sm'
        : '';
    const errorDisplay = printer.error ? escapeHtml(printer.error) : '';
    const amsSlots = printer.bambuddy && Array.isArray(printer.bambuddy.amsSlots) ? printer.bambuddy.amsSlots.slice(0, 4) : [];
    const amsDisplay = printer.ams && (printer.ams.filamentType || printer.ams.filamentColor || printer.ams.temperature !== null || printer.ams.humidity !== null)
      ? escapeHtml(`${printer.ams.filamentType || 'AMS'} / ${printer.ams.filamentColor || 'No color'}`)
      : '';
    const amsDisplayHtml = amsSlots.length > 0
      ? `
        <span class="printer-ams-swatches">
          ${amsSlots.map((slot) => `<span class="printer-ams-swatch" style="background:${escapeHtml(slot.color || '#3a4654')}" title="${escapeHtml(slot.type || 'Filament')}"></span>`).join('')}
        </span>
      `
      : (amsDisplay ? `<span>${amsDisplay}</span>` : '');

    const card = document.createElement('div');
    card.className = `printer-card ${statusClass}`;
    card.setAttribute('data-printer-id', String(printer.id));
    card.onclick = () => openPrinterModal(printer.id);
    let etaDiv = '';
    if (printer.progress && printer.progress.remainingSec > 0) {
      const etaDate = new Date(Date.now() + printer.progress.remainingSec * 1000);

      let hours = etaDate.getHours();
      const minutes = String(etaDate.getMinutes()).padStart(2, '0');
      // const seconds = String(etaDate.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';

      hours = hours % 12;
      hours = hours ? hours : 12; // Handle midnight (0 should be 12)

      const etaTime = `${hours}:${minutes} ${ampm}`;
      etaDiv = `<div class="printer-meta-row"><span class="printer-meta-label">Estimated finish time:</span><span class="printer-meta-value">${etaTime}</span></div>`;
    }
    let remainingDiv = printer.progress.remainingSec > 0 ? `<div class="printer-meta-row"><span class="printer-meta-label">Remaining:</span><span class="printer-meta-value">${remaining}</span></div>` : '';

    card.innerHTML = `
      <div class="printer-card-title">
        <span class="printer-card-name">${escapeHtml(printer.name || `Printer ${printer.id}`)}</span>
        <span class="printer-status-pill">${stateText}</span>
      </div>
      <div class="printer-meta">
        <div class="printer-meta-row"><span class="printer-meta-label">State:</span><span class="printer-meta-value">${stateText}</span></div>
        <div class="printer-meta-row"><span class="printer-meta-label">Nozzle:</span><span class="printer-meta-value">${nozzle}${nozzleTarget}</span></div>
        <div class="printer-meta-row"><span class="printer-meta-label">Bed:</span><span class="printer-meta-value">${bed}${bedTarget}</span></div>
        ${remainingDiv}
        ${etaDiv}
        <div class="printer-meta-row"><span class="printer-meta-label">File:</span><span class="printer-meta-value printer-meta-value-file${fileClass}">${fileDisplay}</span></div>
        ${amsDisplayHtml ? `<div class="printer-meta-row"><span class="printer-meta-label">AMS:</span><span class="printer-meta-value">${amsDisplayHtml}</span></div>` : ''}
        ${printer.error ? `<div class="printer-meta-row"><span class="printer-meta-label">Error:</span><span class="printer-meta-value">${errorDisplay}</span></div>` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

function getPrinterStatusClass(printer) {
  const state = String(printer.state || '').toLowerCase();
  if (printer.error) return 'printer-status-error';
  if (state.includes('error') || state.includes('fault') || state.includes('offline')) return 'printer-status-error';
  if (state.includes('pause') || state.includes('assist') || state.includes('attention')) return 'printer-status-attention';
  if (state.includes('printing') || state.includes('heating') || state.includes('run')) return 'printer-status-busy';
  if (printer.isIdle) return 'printer-status-ok';
  return 'printer-status-ok';
}

function buildPrinterActionButtons(printer) {
  const commandSet = printer.commands || {};
  const state = String(printer.state || '').toLowerCase();
  const isPaused = state.includes('pause');
  const hasActivePrint = Boolean(printer.isPrinting || isPaused);
  const disabledAttr = (isDisabled) => (isDisabled ? ' disabled aria-disabled="true"' : '');
  const buttons = [];

  if (commandSet.pause) {
    const disabled = !hasActivePrint || isPaused;
    buttons.push(`<button class="printer-action-btn pause"${disabledAttr(disabled)} onclick="sendPrinterCommand('${printer.id}', 'pause')"><i class="fas fa-pause"></i> Pause Print</button>`);
  }
  if (commandSet.resume) {
    const disabled = !hasActivePrint || !isPaused;
    buttons.push(`<button class="printer-action-btn resume"${disabledAttr(disabled)} onclick="sendPrinterCommand('${printer.id}', 'resume')"><i class="fas fa-play"></i> Resume Print</button>`);
  }
  if (commandSet.stop) {
    const disabled = !hasActivePrint;
    buttons.push(`<button class="printer-action-btn stop"${disabledAttr(disabled)} onclick="sendPrinterCommand('${printer.id}', 'stop')"><i class="fas fa-stop"></i> Stop Print</button>`);
  }
  if (commandSet.lastJob) {
    const disabled = hasActivePrint;
    buttons.push(`<button class="printer-action-btn lastjob"${disabledAttr(disabled)} onclick="sendPrinterCommand('${printer.id}', 'lastJob')"><i class="fas fa-history"></i> Print Last Job</button>`);
  }
  if (printer.camera && printer.camera.snapshotUrl) {
    buttons.push('<button class="printer-action-btn camera" onclick="togglePrinterCamera()"><i class="fas fa-camera"></i> Show Camera</button>');
  }

  return buttons;
}

function mapPrintStateText(value) {
  const raw = String(value || 'Unknown').trim();
  const key = raw.toLowerCase();
  if (key === 'finish' || key === 'finished') return 'Finished';
  if (key === 'standby' || key === 'idle') return 'Ready to print';
  if (key.includes('print')) return 'Printing';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function renderBambuModalBody(printer) {
  const meta = printer.bambuddy || {};
  const ams = printer.ams || {};
  const slots = Array.isArray(meta.amsSlots) ? meta.amsSlots : [];
  const nozzle = printer.temperatures && printer.temperatures.nozzle !== null && printer.temperatures.nozzle !== undefined
    ? `${Math.round(printer.temperatures.nozzle)}°C` : '--';
  const bed = printer.temperatures && printer.temperatures.bed !== null && printer.temperatures.bed !== undefined
    ? `${Math.round(printer.temperatures.bed)}°C` : '--';
  const progress = printer.progress && Number.isFinite(Number(printer.progress.percent)) ? Number(printer.progress.percent) : 0;
  const signal = Number.isFinite(meta.wifiSignal) ? `${meta.wifiSignal}dBm` : '--dBm';
  const firmware = meta.firmware || '--';
  const modelLine = [meta.model || 'P1S', meta.nozzleDiameter ? `${meta.nozzleDiameter}mm` : ''].filter(Boolean).join(' • ');
  const statusLine = mapPrintStateText(printer.state);
  const jobLine = printer.filename ? escapeHtml(printer.filename) : 'No active job';
  const slotHtml = slots.length
    ? slots.map((slot) => `
      <div class="bambu-slot">
        <div class="bambu-slot-index">${slot.index}</div>
        <div class="bambu-slot-type">${escapeHtml(slot.type || 'Empty')}</div>
        <div class="bambu-slot-k">${slot.kFactor !== null && slot.kFactor !== undefined ? `K ${Math.round(slot.kFactor*1000)/1000}` : '--'}</div>
      <div class="bambu-slot-color-box" style="background:${escapeHtml(slot.color || '#3a4654')}"></div>
      </div>
    `).join('')
    : '<div class="bambu-slot-empty">No AMS tray data</div>';

  let etaDiv = '';
  if (printer.progress && printer.progress.remainingSec > 0) {
    const etaDate = new Date(Date.now() + printer.progress.remainingSec * 1000);

    let hours = etaDate.getHours();
    const minutes = String(etaDate.getMinutes()).padStart(2, '0');
    // const seconds = String(etaDate.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';

    hours = hours % 12;
    hours = hours ? hours : 12; // Handle midnight (0 should be 12)

    const etaTime = `${hours}:${minutes} ${ampm}`;
    etaDiv = `<div class="bambu-progress-pct"><span class="bambu-progress-pct">Estimated finish time:</span><span>${etaTime}</span></div>`;
  }

  return `
    <div class="bambu-modal">
      <div class="bambu-header">
        <div class="bambu-header-sub">${escapeHtml(modelLine || 'P1S')}</div>
        <div class="bambu-chip-row">
          <span class="bambu-chip"><i class="fas fa-link"></i> ${meta.connected === false ? 'Disconnected' : 'Connected'}</span>
          <span class="bambu-chip"><i class="fas fa-signal"></i> ${escapeHtml(signal)}</span>
          <span class="bambu-chip"><i class="fas fa-check-circle"></i> ${printer.error ? 'Error' : 'OK'}</span>
          <span class="bambu-chip"><i class="fas fa-tag"></i> ${escapeHtml(firmware)}</span>
        </div>
      </div>
      <div class="bambu-status-block">
        <div class="bambu-section-label">Status</div>
        <div class="bambu-status-title">${escapeHtml(statusLine)}</div>
        <div class="bambu-status-job">${jobLine}</div>
        <div class="bambu-progress-wrap">
          <div class="bambu-progress-bar"><span style="width:${Math.max(0, Math.min(100, progress))}%"></span></div>
          <div class="bambu-progress-pct">${Math.round(progress)}%</div>
        </div>
        ${etaDiv}
      </div>
      <div class="bambu-temp-grid">
        <div class="bambu-stat-card"><div class="bambu-stat-label">Nozzle</div><div class="bambu-stat-value">${nozzle}</div></div>
        <div class="bambu-stat-card"><div class="bambu-stat-label">Bed</div><div class="bambu-stat-value">${bed}</div></div>
      </div>
      <div class="bambu-filament-block">
        <div class="bambu-section-label">Filaments</div>
        <div class="bambu-ams-header">${escapeHtml(meta.amsName || 'AMS-A')} 
          <span><span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="lightblue" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-droplets w-4 h-4" aria-hidden="true">
              <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path>
            </svg>
          </span>
          ${ams.humidity !== null && ams.humidity !== undefined ? `${ams.humidity}%` : '--%'} • 
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-thermometer w-4 h-4" aria-hidden="true"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"></path></svg>
          ${ams.temperature !== null && ams.temperature !== undefined ? `${ams.temperature}°C` : '--°C'}</span></div>
          <div class="bambu-slot-grid">${slotHtml}</div>
      </div>
    </div>
  `;
}

function openPrinterModal(printerId) {
  const printer = printerCache[printerId];
  const modal = document.getElementById('printerModal');
  const modalCard = modal ? modal.querySelector('.printer-modal-card') : null;
  const title = document.getElementById('printerModalTitle');
  const body = document.getElementById('printerModalBody');
  const actions = document.getElementById('printerModalActions');
  const cameraWrap = document.getElementById('printerModalCamera');
  const cameraImage = document.getElementById('printerModalCameraImage');

  if (!printer || !modal || !title || !body || !actions || !cameraWrap || !cameraImage || !modalCard) return;

  selectedPrinterId = printerId;
  title.textContent = printer.name || `Printer ${printer.id}`;

  const isBambuModal = Number(printer.id) === 106;
  modalCard.classList.toggle('printer-modal-card-bambu', isBambuModal);
  if (isBambuModal) {
    body.innerHTML = renderBambuModalBody(printer);
  } else {
    const nozzle = printer.temperatures && printer.temperatures.nozzle !== null && printer.temperatures.nozzle !== undefined
      ? `${printer.temperatures.nozzle}°C` : '--';
    const bed = printer.temperatures && printer.temperatures.bed !== null && printer.temperatures.bed !== undefined
      ? `${printer.temperatures.bed}°C` : '--';
    const chamber = printer.temperatures && printer.temperatures.chamber !== null && printer.temperatures.chamber !== undefined
      ? `${printer.temperatures.chamber}°C` : '--';
    const elapsed = formatDuration(printer.progress && printer.progress.elapsedSec);
    const remaining = formatDuration(printer.progress && printer.progress.remainingSec);
    const ams = printer.ams || {};
    const amsDetails = [
      ams.moduleType ? `${escapeHtml(ams.moduleType)}` : '',
      ams.temperature !== null && ams.temperature !== undefined ? `Temp: ${ams.temperature}°C` : '',
      ams.humidity !== null && ams.humidity !== undefined ? `Humidity: ${ams.humidity}%` : '',
      ams.filamentType ? `Filament: ${escapeHtml(ams.filamentType)}` : '',
      ams.filamentColor ? `Color: ${escapeHtml(ams.filamentColor)}` : ''
    ].filter(Boolean).join(' • ');

    // --- NEW: Calculate and format the ETA ---
    let etaDiv = '';
    if (printer.progress && printer.progress.remainingSec > 0) {
      const etaDate = new Date(Date.now() + printer.progress.remainingSec * 1000);

      let hours = etaDate.getHours();
      const minutes = String(etaDate.getMinutes()).padStart(2, '0');
      const seconds = String(etaDate.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';

      hours = hours % 12;
      hours = hours ? hours : 12; // Handle midnight (0 should be 12)

      const etaTime = `${hours}:${minutes}:${seconds} ${ampm}`;
      etaDiv = `<div class="printer-modal-item"><strong>ETA</strong>${etaTime}</div>`;
    }
    // ----------------------------------------

    let elapsedDiv = printer.progress.elapsedSec > 0 ? `<div class="printer-modal-item"><strong>Elapsed</strong>${elapsed}</div>` : '';
    let remainingDiv = printer.progress.remainingSec > 0 ? `<div class="printer-modal-item"><strong>Remaining</strong>${remaining}</div>` : '';

    body.innerHTML = `
      <div class="printer-modal-item"><strong>Status</strong>${escapeHtml(printer.state || '--')}</div>
      <div class="printer-modal-item"><strong>File</strong>${escapeHtml(printer.filename || '--')}</div>
      <div class="printer-modal-item"><strong>Error</strong>${escapeHtml(printer.error || '--')}</div>
      <div class="printer-modal-item"><strong>Driver</strong>${escapeHtml(printer.driver || '--')}</div>
      <div class="printer-modal-item"><strong>Nozzle Temp</strong>${nozzle}</div>
      <div class="printer-modal-item"><strong>Bed Temp</strong>${bed}</div>
      <div class="printer-modal-item"><strong>Chamber Temp</strong>${chamber}</div>
      ${elapsedDiv}
      ${remainingDiv}
      ${etaDiv}
      <div class="printer-modal-item"><strong>AMS</strong>${amsDetails || '--'}</div>
    `;
  }

  const buttons = buildPrinterActionButtons(printer);

  if (buttons.length === 0) {
    actions.innerHTML = '<div class="printer-modal-item" style="width:100%;">No print-control commands are currently available for this printer.</div>';
  } else {
    actions.innerHTML = buttons.join('');
  }
  cameraWrap.style.display = 'none';
  cameraImage.src = '';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closePrinterModal() {
  const modal = document.getElementById('printerModal');
  const modalCard = modal ? modal.querySelector('.printer-modal-card') : null;
  const cameraWrap = document.getElementById('printerModalCamera');
  const cameraImage = document.getElementById('printerModalCameraImage');
  if (!modal || !cameraWrap || !cameraImage) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (modalCard) {
    modalCard.classList.remove('printer-modal-card-bambu');
  }
  cameraWrap.style.display = 'none';
  cameraImage.src = '';
  selectedPrinterId = null;
}

function togglePrinterCamera() {
  if (!selectedPrinterId) return;
  const printer = printerCache[selectedPrinterId];
  const cameraWrap = document.getElementById('printerModalCamera');
  const cameraImage = document.getElementById('printerModalCameraImage');

  if (!printer || !cameraWrap || !cameraImage || !printer.camera || !printer.camera.snapshotUrl) return;

  const currentlyShown = cameraWrap.style.display !== 'none';
  if (currentlyShown) {
    cameraWrap.style.display = 'none';
    cameraImage.src = '';
    return;
  }

  const snapshotUrl = printer.camera.snapshotUrl;
  const ts = Date.now();
  const separator = snapshotUrl.includes('?') ? '&' : '?';
  cameraImage.src = `${snapshotUrl}${separator}ts=${ts}`;
  cameraWrap.style.display = 'block';
}

function sendPrinterCommand(printerId, actionKey) {
  const printer = printerCache[printerId];
  if (!printer || !printer.commands || !printer.commands[actionKey]) return;

  uibuilder.send({
    topic: 'control',
    payload: {
      type: 'printer',
      deviceId: printerId,
      command: printer.commands[actionKey]
    }
  });
}

// Update Landroid Mowers Display Panel
function updateMowers(mowers) {
  const container = document.getElementById('mowerContainer');
  if (!container || !mowers) { return;
  }

  // Clear previous cards before building the new batch
  container.innerHTML = '';

  
  // Loop natively through our object keys ("top" and "bottom")
  Object.keys(mowers).forEach(key => {
    const mower = mowers[key];

    // 1. 🟢 DYNAMIC EMOJI LOGIC FOR MAIN STATE ICON
    let stateIcon = '🤖'; // Fallback

    if (mower.error && mower.error.id != 0) {
      stateIcon = '⚠️';
    } else if (mower.state === 'mowing') {
      stateIcon = '🚜';
    } else if (mower.state === 'edging') {
      stateIcon = '✂️';
    } else if (mower.state === 'returning') {
      stateIcon = '🏠';
    } else if (mower.state === 'docked' || mower.state === 'idle') {
      // 🟢 Check if it's currently charging at the dock base
      if (mower.charging === 'on') {
        // Wraps the lightning bolt in an animated pulsing/glowing CSS wrapper
        stateIcon = '💤'; // '<span class="mower-charging-animated-icon mower-battery-pulse" style="display: inline-block;">⚡</span>';
      } else {
        stateIcon = '💤'; // Sleep emoji if just parked and not drawing active power
      }
    }

    // 2. Set structural styles if a machine fault flag is active
    const isError = mower.error && mower.error.id != 0;
    let cardBg = isError ? 'rgba(231, 76, 60, 0.15)' : 'rgba(255, 255, 255, 0.04)';
    let cardBorder = isError ? '2px solid #e74c3c' : '1px solid rgba(255,255,255,0.08)';
    
    // 🟢 DYNAMIC BUTTON LOGIC (Fixed attribute nesting)
    const mState = String(mower.state || 'unknown').toLowerCase();
    let btnText = 'Start Mowing';
    let btnCommand = 'startMowing';
    let btnIcon = 'fa-play';
    let btnColor = '#2ecc71'; // Green
    let isBtnDisabled = false; // Switch to a clean boolean flag

    if (mState === 'mowing') {
      btnText = 'Go Home';
      btnCommand = 'dock';
      btnIcon = 'fa-home';
      btnColor = '#3498db'; // Blue
    } else if (mState === 'idle' || mState === 'docked') {
      btnText = 'Start Mowing';
      btnCommand = 'startMowing';
      btnIcon = 'fa-play';
      btnColor = '#2ecc71'; // Green
    } else {
      btnText = mState === 'returning' ? 'Returning Home' : 'Unavailable';
      btnIcon = 'fa-ban';
      btnColor = '#4a4a4a'; // Grey
      isBtnDisabled = true;
    }

    if (isError) {
      if ( mower.error.id === 99 ) {
        btnText = 'Rain must clear';
        btnIcon = 'fa-cloud-rain';
        btnColor = '#2980b9'; // Belize Hole Blue
      } else {
        btnText = 'Clear Fault First';
        btnIcon = 'fa-exclamation-triangle';
        btnColor = '#c0392b'; // Dark Red
      }
      isBtnDisabled = true;
    }

    // Determine opacity and cursor types natively based on the boolean state flag
    const currentOpacity = isBtnDisabled ? "0.7" : "1.0";
    const currentCursor = isBtnDisabled ? "not-allowed" : "pointer";

    let chargingGraphics = '';
    let displayState = mower.state || 'Unknown';
    let stateColour = "#3498db";
    if (isError) {
      if(mower.error.id == 99) {
        cardBg = "#34495e";
        cardBorder = "2px solid #3498db";
        // stateColour = "#2980b9";
        stateColour = "#e74c3c";
        displayState = "Delayed";
        stateIcon = '<i class="fa-solid fa-cloud-rain fa-inverse" data-fa-transform="shrink-10 down-2"></i>';
      } else {
        stateColour = "#e74c3c";
        displayState = "Fault";
      }
    } else {
      if (mower.charging === 'on') {
        chargingGraphics = '<span class="mower-battery-pulse" style="display: inline-flex; align-items: center; color: #2ecc71; margin-left: 2px;">⚡</span>';
        displayState = "Charging";
      }
      if (displayState.toLowerCase() == 'docked') {
        displayState = 'Home';
      }
    }

    let errorDisplay = ''
    if ( isError ) { 
      errorDisplay = mower.error.id == 99 ? `
                      <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                        <span style="opacity: 0.65;">Diagnostics:</span>
                        <span style="color: ${stateColour}; font-weight: bold;">Rain Delayed</span>
                      </div>
                  ` : `
                      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-top: 4px; padding: 6px 10px; background: rgba(231,76,60,0.18); border-radius: 6px; color: #e74c3c; font-weight: bold; font-size: 1rem;">
                        <span style="flex-basis: 100%; text-align: center; font-size: 1.1rem; margin-bottom: 2px;">Fault</span>
                        <span style="flex-basis: 100%; text-align: center;font-size: 0.85rem;">${mower.error.label}</span>
                      </div>
                  `;
    }

    // 3. Create the inner HTML content block
    const cardHtml = `
      <div class="mower-card" style="flex: 1; padding: 14px; border-radius: 10px; background-color: ${cardBg}; border: ${cardBorder}; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">

          <div>
              <h3 style="margin: 0 0 10px 0; text-transform: capitalize; font-size: 1.05rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px; color: #ffffff;">
                  ${key} Yard Mower
              </h3>
              
              <div style="text-align: center; margin: 12px 0; font-size: 3.2rem; line-height: 1;">
                  ${stateIcon}
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: #ffffff; margin-bottom: 12px;">
                  <div style="display: flex; justify-content: space-between;">
                      <span style="opacity: 0.65;">Operation:</span>
                      <span style="font-weight: 600; text-transform: uppercase; color: ${stateColour};">${displayState}</span>
                  </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="opacity: 0.65;">Battery Power:</span>
                  <span style="font-weight: 600; display: flex; align-items: center; gap: 4px;">
                      <span>🔋</span>${mower.battery || '--'}%
                      ${chargingGraphics}
                  </span>
              </div>

                  ${isError ? errorDisplay : `
                      <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                        <span style="opacity: 0.65;">Diagnostics:</span>
                        <span style="color: ${stateColour};">Healthy</span>
                      </div>
                  `}

                  <div style="display: flex; justify-content: space-between; font-size: 0.75rem; opacity: 0.35; margin-top: 6px; border-top: 1px dotted rgba(255,255,255,0.05); padding-top: 4px;">
                      <span>Refreshed:</span>
                      <span>${mower.updated || '--:--'}</span>
                  </div>
              </div>
          </div>

          <!-- 🟢 ONE UNIFIED CLEAN STYLE PROPERTY (Resolves attribute conflict) -->
          <button class="mower-btn" 
                  ${isBtnDisabled ? 'disabled' : ''}
                  onclick="triggerMowerAction('${key}', '${btnCommand}')"
                  style="width: 100%; height: 42px !important; flex-shrink: 0 !important; padding: 10px; border: none; border-radius: 6px; background-color: ${btnColor}; color: #ffffff !important; font-weight: bold; cursor: ${currentCursor}; opacity: ${currentOpacity}; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity 0.2s;">
              <i class="fas ${btnIcon}"></i> ${btnText}
          </button>
      </div>
    `;

    // 4. Inject the compiled string smoothly into your placeholder frame
    container.insertAdjacentHTML('beforeend', cardHtml);
  });
}

// Send command back to Node-RED to fire the startMowing sequence
// Send dynamic layout commands back to Node-RED websocket loop rails
function triggerMowerAction(yardKey, commandString) {
  const deviceId = yardKey === 'bottom' ? '88' : '95';
  
  // 🟢 OPTIMISTIC UI LOCKOUT: Find the specific button that was pressed
  // Locates the button inside the active mower card framework
  const card = document.querySelector(`[onclick*="triggerMowerAction('${yardKey}'"]`);
  if (card) {
      card.disabled = true;
      card.style.opacity = "0.5";
      card.style.cursor = "not-allowed";
      card.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
  }
  
  console.log(`Sending execution command [${commandString}] to ${yardKey} yard mower (ID: ${deviceId})`);
  
  // Package payload variables up to Node-RED's backend channel
  uibuilder.send({
    topic: 'control',
    payload: {
      type: 'mower',
      deviceId: deviceId,
      command: commandString 
    }
  });
}
// Update Lights Display
function updateLights(lights) {
  const grid = document.getElementById('lightsGrid');
  if (!grid) return;

  // Get existing tiles
  const existingTiles = {};
  grid.querySelectorAll('.light-tile').forEach(tile => {
    const deviceId = tile.getAttribute('data-device-id');
    existingTiles[deviceId] = tile;
  });

  // Update or create tiles
  lights.forEach(light => {
    const existingTile = existingTiles[light.id];
    
    if (existingTile) {
      // Tile exists - update its state
      existingTile.classList.remove('on', 'off');
      existingTile.classList.add(light.state);
      existingTile.onclick = () => toggleLight(light.id, light.state);
      // Remove from tracking object
      delete existingTiles[light.id];
    } else {
      // New tile - create it
      const tile = document.createElement('div');
      tile.className = `light-tile ${light.state}`;
      tile.setAttribute('data-device-id', light.id);
      tile.onclick = () => toggleLight(light.id, light.state);

      tile.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="light-bulb-container">
                <i class="fa fa-lightbulb light-bulb"></i>
            </div>
            <div class="light-label">${light.name}</div>
        `;

      grid.appendChild(tile);
    }
  });

  // Remove any tiles that no longer exist in the light list
  Object.values(existingTiles).forEach(tile => tile.remove());
}

// Toggle Light
function toggleLight(deviceId, currentState) {
  // console.log(`Toggling light ${deviceId} from ${currentState}`);
  const tile = document.querySelector(`[data-device-id="${deviceId}"]`);
  if (!tile) return;

  const newState = currentState === 'on' ? 'off' : 'on';

  // Immediate optimistic UI update - change state on click
  tile.classList.remove('on', 'off');
  tile.classList.add(newState);
  tile.onclick = () => toggleLight(deviceId, newState);

  // Send command to Node-RED
  uibuilder.send({
    topic: 'control',
    payload: {
      type: 'light',
      deviceId: deviceId,
      command: newState
    }
  });
}

// Update Battery Display
function updateBattery(data) {
  const fill = document.getElementById('batteryFill');
  const percentage = document.getElementById('batteryPercentage');
  const state = document.getElementById('batteryState');
  const chargingSymbol = document.getElementById('chargingSymbol');

  if (!fill || !percentage || !state) return;

  // Update percentage
  const soc = Math.max(0, Math.min(100, data.SOC || 0));
  percentage.textContent = soc + '%';
  fill.style.width = soc + '%';

  // Update color based on level
  let color;
  if (soc < 20) color = '#ff4444';
  else if (soc < 40) color = '#ff9100';
  else if (soc < 60) color = '#fff200';
  else if (soc < 80) color = '#d7fc03';
  else color = '#00ff00';
  fill.style.background = color;

  // Update status
  const stateText = (data.state || 'idle').toLowerCase();
  state.textContent = stateText;
  state.className = 'battery-state-text ' + stateText;

  // Handle charging indicator
  if (stateText === 'charging') {
    chargingSymbol.classList.add('active');
  } else {
    chargingSymbol.classList.remove('active');
  }
}

// Update Weather Display
function updateWeather(data) {
  const tempMain = document.getElementById('currentTemp');
  const weatherDesc = document.getElementById('weatherDesc');
  const feelsLike = document.getElementById('feelsLike');
  const humidity = document.getElementById('humidity');
  const minMax = document.getElementById('minMax');
  const wind = document.getElementById('wind');
  const weatherIcon = document.getElementById('weatherIcon');

  if (!tempMain) return;

  // Update temperature
  tempMain.textContent = (data.temperature !== null && data.temperature !== undefined)
    ? data.temperature + '°C' : '--°C';

  // Update description from Google Weather forecast
  weatherDesc.textContent = data.day_condition || 'Loading...';

  // Update weather icon from Google Weather
  if (data.weather_icon && weatherIcon) {
    weatherIcon.src = data.weather_icon;
    weatherIcon.style.display = 'block';
  } else if (weatherIcon) {
    weatherIcon.style.display = 'none';
  }

  // Update feels like
  feelsLike.textContent = (data.apparent_temperature !== null && data.apparent_temperature !== undefined)
    ? data.apparent_temperature + '°C' : '--°C';

  // Update humidity
  humidity.textContent = (data.humidity !== null && data.humidity !== undefined)
    ? data.humidity + '%' : '--%';

  // Update min/max
  const minTemp = (data.min_temperature !== null && data.min_temperature !== undefined)
    ? data.min_temperature : '--';
  const maxTemp = (data.max_temperature !== null && data.max_temperature !== undefined)
    ? data.max_temperature : '--';
  minMax.textContent = `${minTemp}° / ${maxTemp}°`;

  // Update wind with direction arrow
  const windSpeed = (data.wind_speed !== null && data.wind_speed !== undefined)
    ? data.wind_speed : '--';
  const windDirText = data.wind_direction || '';
  const windDirDegrees = data.wind_direction_degrees;
  
  // Create wind direction arrow
  let windArrow = '';
  if (windDirDegrees !== null && windDirDegrees !== undefined) {
    windArrow = `<span class="wind-arrow" style="display:inline-block; transform:rotate(${windDirDegrees}deg);">↓</span> `;
  }
  
  wind.innerHTML = `${windArrow}${windSpeed} km/h ${windDirText}`;

  // Update rain chance (from forecast data if available)
  const rainChanceEl = document.getElementById('rainChance');
  if (rainChanceEl) {
    if (data.precipitation_prob_day !== null && data.precipitation_prob_day !== undefined) {
      rainChanceEl.textContent = `${data.precipitation_prob_day}%`;
    } else if (data.rainfall_24hr !== null && data.rainfall_24hr !== undefined) {
      rainChanceEl.textContent = `${data.rainfall_24hr}mm (24h)`;
    } else {
      rainChanceEl.textContent = '--';
    }
  }
}

// Update Solar Widget
function updateSolarWidget(data) {
  if (solarWidget && typeof solarWidget.updateData === 'function') {
    solarWidget.updateData(data);
  }
}

// Update Timestamp
function updateTimestamp() {
  const lastUpdateEl = document.getElementById('lastUpdate');
  if (lastUpdateEl) {
    const now = new Date();
    lastUpdateEl.textContent = now.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
}
console.log('Dashboard script initialized');
