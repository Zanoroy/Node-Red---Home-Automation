// Dashboard JavaScript using uibuilder
/* globals uibuilder */

// Initialize solar widget
let solarWidget;
let selectedPrinterId = null;
const printerCache = {};

// Track recently toggled lights to prevent race condition
const recentlyToggled = new Map();
const rgbLightColorCache = new Map();

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function () {
  console.log('Dashboard loaded');
  setupPrinterModalEvents();
  setupRgbColorModal();

  setTimeout(
    setupUibuilder,
    800
  );

});

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
      uibuilder.send({
        topic: 'dashboard',
        payload: 'dashboard'
      });
    } else {
      statusEl.className = 'status-indicator offline';
      statusEl.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
    }
  });

  // Handle incoming messages
  uibuilder.onChange('msg', function (msg) {
    console.log('Received message:', msg);

    if (msg.topic === 'hubitat_devices') {
      const payload = msg && typeof msg.payload === 'object' && msg.payload ? msg.payload : {};
      updateWeather(payload.weather);
      updateLights(Array.isArray(payload.lights) ? payload.lights : []);
      updateSwitches(Array.isArray(payload.switches) ? payload.switches : []);
      updateMowers(payload.mowers && typeof payload.mowers === 'object' ? payload.mowers : {});
      updatePrinters(Array.isArray(payload.printers) ? payload.printers : []);
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
  if (s > 0) {
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }

  return `${m}m`;
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
    const statusText = printer.healthstatus;
    const stateText = printer.healthstatus.toLowerCase() == 'online' ? escapeHtml(printer.state || 'unknown') : 'OFFLINE';
    const nozzle = printer.temperatures && printer.temperatures.nozzle !== null && printer.temperatures.nozzle !== undefined
      ? `${Math.round(printer.temperatures.nozzle * 10) / 10}°C` : '--';
    const bed = printer.temperatures && printer.temperatures.bed !== null && printer.temperatures.bed !== undefined
      ? `${Math.round(printer.temperatures.bed * 10) / 10}°C` : '--';
    const nozzleTarget = printer.temperatures && printer.temperatures.nozzletarget !== null && printer.temperatures.nozzleTarget !== undefined && printer.temperatures.nozzleTarget > 0
      ? `/${Math.round(printer.temperatures.nozzletarget * 10) / 10}°C` : '';
    const bedTarget = printer.temperatures && printer.temperatures.bedtarget !== null && printer.temperatures.bedtarget !== undefined && printer.temperatures.bedtarget > 0
      ? `/${Math.round(printer.temperatures.bedtarget * 10) / 10}°C` : '';
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
    const printerFilaments = Array.isArray(printer.filaments) ? printer.filaments : [];
    const snapmakerFilaments = printer.snapmaker && Array.isArray(printer.snapmaker.filaments)
      ? printer.snapmaker.filaments
      : [];
    const rawFilamentSlots = printerFilaments.length > 0 ? printerFilaments : snapmakerFilaments;
    const filamentSlots = rawFilamentSlots.length > 0
      ? Array.from({ length: Math.max(4, rawFilamentSlots.length) }, (_, index) => rawFilamentSlots[index] || { index: index + 1, exists: false })
      : [];
    const amsDisplay = printer.ams && (printer.ams.filamentType || printer.ams.filamentColor || printer.ams.temperature !== null || printer.ams.humidity !== null)
      ? escapeHtml(`${printer.ams.filamentType || 'AMS'} / ${printer.ams.filamentColor || 'No color'}`)
      : '';
    const amsDisplayHtml = amsSlots.length > 0
      ? `
        <span class="printer-ams-swatches">
          ${amsSlots.map((slot, index) => {
        const isLoaded = slot && slot.exists !== false;
        const slotNumber = slot && slot.index !== null && slot.index !== undefined ? slot.index : index + 1;
        const filamentType = slot && (slot.type || 'Unloaded/Empty');
        const title = isLoaded ? `Slot ${slotNumber} ${filamentType}` : `Slot ${slotNumber} Unloaded`;
        const color = isLoaded ? (slot.color || '#3a4654') : 'transparent';
        const classes = isLoaded ? 'printer-ams-swatch' : 'printer-ams-swatch printer-ams-swatch-empty';
        return `<span class="${classes}" style="background:${escapeHtml(color)}" title="${escapeHtml(title)}"></span>`;
        //return `<span class="printer-ams-swatch" style="background:${escapeHtml(slot.color || '#3a4654')}" title="${escapeHtml(slot || '' || slot.type || 'Empty/Unloaded')}"></span>`;
      }).join('')}
        </span>
      `
      : (amsDisplay ? `<span>${amsDisplay}</span>` : '');
    const filamentDisplayHtml = filamentSlots.length > 0
      ? `
        <span class="printer-ams-swatches">
          ${filamentSlots.map((filament, index) => {
        const isLoaded = filament && filament.exists !== false;
        const slotNumber = filament && filament.index !== null && filament.index !== undefined ? filament.index : index + 1;
        const filamentType = filament && (filament.type || (filament.details && filament.details.type) || 'Filament');
        const title = isLoaded ? `Slot ${slotNumber} ${filamentType}` : 'Unloaded';
        const color = isLoaded ? (filament.color || '#3a4654') : 'transparent';
        const classes = isLoaded ? 'printer-ams-swatch' : 'printer-ams-swatch printer-ams-swatch-empty';

        return `<span class="${classes}" style="background:${escapeHtml(color)}" title="${escapeHtml(title)}"></span>`;
      }).join('')}
        </span>
      `
      : '';

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
    let nozzleDiv = `<div class="printer-meta-row"><span class="printer-meta-label">Nozzle:</span><span class="printer-meta-value">${nozzle}${nozzleTarget}</span></div>`;
    card.innerHTML = `
      <div class="printer-card-title">
        <span class="printer-card-name">${escapeHtml(printer.name || `Printer ${printer.id}`)}</span>
        <span class="printer-status-pill">${statusText}</span>
      </div>
      <div class="printer-meta">
        <div class="printer-meta-row"><span class="printer-meta-label">State:</span><span class="printer-meta-value">${stateText}</span></div>
        ${nozzleDiv}
        <div class="printer-meta-row"><span class="printer-meta-label">Bed:</span><span class="printer-meta-value">${bed}${bedTarget}</span></div>
        ${remainingDiv}
        ${etaDiv}
        <div class="printer-meta-row"><span class="printer-meta-label">File:</span><span class="printer-meta-value printer-meta-value-file${fileClass}">${fileDisplay}</span></div>
        ${filamentDisplayHtml ? `<div class="printer-meta-row"><span class="printer-meta-label">Filament:</span><span class="printer-meta-value">${filamentDisplayHtml}</span></div>` : ''}
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
  if (printer.healthstatus && printer.healthstatus.toLowerCase() !== 'online' && printer.healthstatus.toLowerCase() !== 'true') return 'printer-status-attention';
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
        <div class="bambu-slot-k">${slot.kFactor !== null && slot.kFactor !== undefined ? `K ${Math.round(slot.kFactor * 1000) / 1000}` : '--'}</div>
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

function renderSnapmakerModalBody(printer) {
  const snapmaker = printer.snapmaker || {};
  const bed = printer.temperatures && printer.temperatures.bed !== null && printer.temperatures.bed !== undefined
    ? `${printer.temperatures.bed}°C` : '--';
  const progress = printer.progress || {};
  const remainingSecondsRaw = progress.remainingSec;
  const remainingSeconds = remainingSecondsRaw !== null && remainingSecondsRaw !== undefined && Number.isFinite(Number(remainingSecondsRaw))
    ? Number(remainingSecondsRaw)
    : null;
  const elapsedSecondsRaw = progress.elapsedSec;
  const percentRaw = progress.percent !== null && progress.percent !== undefined ? progress.percent : snapmaker.percent;
  const percent = percentRaw !== null && percentRaw !== undefined && Number.isFinite(Number(percentRaw))
    ? Math.max(0, Math.min(100, Number(percentRaw)))
    : 0;
  const activeHotendRaw = snapmaker.activehotend !== null && snapmaker.activehotend !== undefined
    ? snapmaker.activehotend
    : printer.temperatures && printer.temperatures.nozzle;
  const activeHotend = activeHotendRaw !== null && activeHotendRaw !== undefined && Number.isFinite(Number(activeHotendRaw))
    ? `${Math.round(Number(activeHotendRaw) * 10) / 10}°`
    : '--';
  const bedTemperatureRaw = snapmaker.bedTempC !== null && snapmaker.bedTempC !== undefined
    ? snapmaker.bedTempC
    : printer.temperatures && printer.temperatures.bed;
  const bedTemperature = bedTemperatureRaw !== null && bedTemperatureRaw !== undefined && Number.isFinite(Number(bedTemperatureRaw))
    ? `${Math.round(Number(bedTemperatureRaw) * 10) / 10}°`
    : '--';
  const remainingMinutesRaw = snapmaker.minutesremaining !== null && snapmaker.minutesremaining !== undefined
    ? snapmaker.minutesremaining
    : remainingSeconds !== null
      ? remainingSeconds / 60
      : null;
  const remainingMinutes = remainingMinutesRaw !== null && Number.isFinite(Number(remainingMinutesRaw))
    ? Math.max(0, Math.round(Number(remainingMinutesRaw)))
    : '--';
  const elapsedMinutes = elapsedSecondsRaw !== null && elapsedSecondsRaw !== undefined && Number.isFinite(Number(elapsedSecondsRaw))
    ? `${Math.max(0, Math.floor(Number(elapsedSecondsRaw) / 60))}m`
    : '--';
  let finishTime = '--';
  if (remainingSeconds > 0) {
    const etaDate = new Date(Date.now() + remainingSeconds * 1000);
    const hours = etaDate.getHours() % 12 || 12;
    const minutes = String(etaDate.getMinutes()).padStart(2, '0');
    finishTime = `${hours}:${minutes} ${etaDate.getHours() >= 12 ? 'PM' : 'AM'}`;
  }
  const printSummary = !printer.error ? `
    <div class="snapmaker-print-summary">
      <div class="snapmaker-print-file">
        <span class="snapmaker-print-label">▶ Printing ·</span>
        <span class="snapmaker-print-filename">${escapeHtml(printer.filename || snapmaker.filename || '--')}</span>
      </div>
      <div class="snapmaker-print-temperatures">
        <span>Hotend <b class="snapmaker-print-hotend">${escapeHtml(activeHotend)}</b>/255</span>
        <span>Bed <b class="snapmaker-print-bed">${escapeHtml(bedTemperature)}</b>/80</span>
      </div>
      <div class="snapmaker-print-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}">
        <div style="width:${percent}%"></div>
      </div>
      <div class="snapmaker-print-details">
        <span>${Math.round(percent)}% · Elapsed: ${elapsedMinutes} · <span class="snapmaker-print-remaining">Time: ${remainingMinutes}m left</span></span>
        <span class="snapmaker-eta">Estimated finish time:<span>${finishTime}</span></span>
      </div>
    </div>
  ` : '';
  const extruders = Array.isArray(printer.extruders) ? printer.extruders : [];
  const directFilaments = Array.isArray(printer.filaments) ? printer.filaments : [];
  const snapmakerFilaments = printer.snapmaker && Array.isArray(printer.snapmaker.filaments) ? printer.snapmaker.filaments : [];
  const filamentsByIndex = new Map();

  snapmakerFilaments.forEach((filament) => {
    if (!filament) return;
    const slotIndex = Number(filament.index);
    if (!Number.isFinite(slotIndex)) return;
    filamentsByIndex.set(slotIndex, filament);
  });
  directFilaments.forEach((filament) => {
    if (!filament) return;
    const slotIndex = Number(filament.index);
    if (!Number.isFinite(slotIndex)) return;
    filamentsByIndex.set(slotIndex, { ...filamentsByIndex.get(slotIndex), ...filament });
  });

  const extruderHtml = Array.from({ length: 4 }, (_, index) => {
    const slotNumber = index + 1;
    const extruder = extruders.find((entry) => Number(entry && entry.index) === slotNumber) || null;
    const filament = filamentsByIndex.get(slotNumber) || null;
    const isLoaded = Boolean(filament && filament.exists !== false);
    const tempRaw = extruder && (extruder.tempC !== null && extruder.tempC !== undefined ? extruder.tempC : extruder.temp);
    const targetRaw = extruder && (extruder.targetC !== null && extruder.targetC !== undefined ? extruder.targetC : extruder.target);
    const temp = tempRaw !== null && tempRaw !== undefined ? `${Math.round(Number(tempRaw) * 10) / 10}°C` : '--';
    const target = targetRaw !== null && targetRaw !== undefined ? `${Math.round(Number(targetRaw) * 10) / 10}°C` : '--';
    const filamentType = isLoaded
      ? (filament.details && filament.details.type) || filament.type || '--'
      : '--';
    const swatchColor = isLoaded ? (filament.color || '#3a4654') : 'transparent';

    return `
      <div class="snapmaker-extruder-card${isLoaded ? '' : ' snapmaker-extruder-card-empty'}">
        <div class="snapmaker-extruder-index">Extruder ${slotNumber}</div>
        <div class="snapmaker-extruder-line"><span>Temp</span><span>${escapeHtml(temp)}</span></div>
        <div class="snapmaker-extruder-line"><span>Target</span><span>${escapeHtml(target)}</span></div>
        <div class="snapmaker-extruder-line"><span>Filament</span><span>${escapeHtml(String(filamentType))}</span></div>
        <div class="snapmaker-extruder-line"><span>Status</span><span>${isLoaded ? 'Loaded' : 'Unloaded'}</span></div>
        <div class="snapmaker-extruder-color${isLoaded ? '' : ' snapmaker-extruder-color-empty'}" style="background:${escapeHtml(swatchColor)}"></div>
      </div>
    `;
  }).join('');

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

  const remainingDiv = Number(snapmaker.minutesremaining) > 0
    ? `<div class="printer-modal-item"><strong>Remaining</strong>${escapeHtml(snapmaker.minutesremaining)}</div>`
    : '';
  return `
    ${printSummary}
    ${printer.error ? `<div class="printer-modal-item"><strong>Error</strong>${escapeHtml(printer.error || '--')}</div>` : ''}
    ${remainingDiv}
    ${etaDiv}
    <div class="snapmaker-extruder-block">
      <div class="snapmaker-extruder-header">Extruders</div>
      <div class="snapmaker-extruder-grid">${extruderHtml}</div>
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
  const isSnapmakerModal = Boolean(
    (printer.snapmaker && (Array.isArray(printer.extruders) || Array.isArray(printer.filaments)))
    || String(printer.name || '').toLowerCase().includes('snapmaker')
  );
  modalCard.classList.toggle('printer-modal-card-bambu', isBambuModal);
  if (isBambuModal) {
    body.innerHTML = renderBambuModalBody(printer);
  } else if (isSnapmakerModal) {
    body.innerHTML = renderSnapmakerModalBody(printer);
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
  if (!container || !mowers) {
    return;
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
      if (mower.error.id === 99) {
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
      if (mower.error.id == 99) {
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
    if (isError) {
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
function updateSwitches(switches) {
  const grid = document.getElementById('switchGrid');
  if (!grid) return;

  const existingTiles = new Map();
  grid.querySelectorAll('.switch-tile').forEach(tile => {
    existingTiles.set(tile.dataset.deviceId, tile);
  });

  (Array.isArray(switches) ? switches : []).forEach(device => {
    if (!device || device.id === null || device.id === undefined) return;

    const deviceId = String(device.id);
    const state = String(device.state || '').toLowerCase() === 'on' ? 'on' : 'off';
    const label = device.name || device.label || `Switch ${deviceId}`;
    let tile = existingTiles.get(deviceId);

    if (!tile) {
      tile = document.createElement('div');
      tile.dataset.deviceId = deviceId;
      tile.innerHTML = `
        <i class="fas fa-power-off switch-image" aria-hidden="true"></i>
        <div class="switch-label"></div>
      `;
      grid.appendChild(tile);
    } else {
      existingTiles.delete(deviceId);
    }

    tile.className = `switch-tile ${state}`;
    tile.querySelector('.switch-label').textContent = label;
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-pressed', String(state === 'on'));
    tile.onclick = () => toggleSwitch(tile, deviceId, state);
    tile.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        tile.click();
      }
    };
  });

  existingTiles.forEach(tile => tile.remove());
}

function toggleSwitch(tile, deviceId, currentState) {
  const newState = currentState === 'on' ? 'off' : 'on';
  tile.classList.remove('on', 'off');
  tile.classList.add(newState);
  tile.setAttribute('aria-pressed', String(newState === 'on'));
  tile.onclick = () => toggleSwitch(tile, deviceId, newState);

  uibuilder.send({
    topic: 'control',
    payload: {
      type: 'switch',
      deviceId,
      command: newState
    }
  });
}

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
    let tile = existingTiles[light.id];
    const isRgb = light.type === 'light rgb' || light.deviceType === 'light rgb';

    if (!tile) {
      tile = document.createElement('div');
      tile.setAttribute('data-device-id', light.id);
      tile.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="light-bulb-container">
                <i class="fa fa-lightbulb light-bulb"></i>
            </div>
            <div class="light-label"></div>
        `;
      grid.appendChild(tile);
    } else {
      delete existingTiles[light.id];
    }

    tile.className = `light-tile ${light.state === 'on' ? 'on' : 'off'}${isRgb ? ' light-rgb' : ''}`;
    tile.onclick = () => toggleLight(light.id, light.state);
    tile.querySelector('.light-label').textContent = light.name || light.label || `Light ${light.id}`;

    let swatch = tile.querySelector('.rgb-color-swatch');
    if (isRgb && !swatch) {
      swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'rgb-color-swatch';
      swatch.setAttribute('aria-label', `Choose color for ${light.name || light.label || 'RGB light'}`);
      swatch.addEventListener('click', event => {
        event.stopPropagation();
        openRgbColorModal(tile.rgbLight);
      });
      swatch.addEventListener('pointerdown', event => event.stopPropagation());
      tile.appendChild(swatch);
    } else if (!isRgb && swatch) {
      swatch.remove();
    }

    if (isRgb) {
      tile.rgbLight = light;
      if (light.state === 'on' || !swatch.style.backgroundColor) {
        const colorState = getRgbLightColorState(light);
        updateRgbTileColor(light.id, colorState);
        tile.style.setProperty('--light-hue', String(colorState.hue * 3.6));
      }
    }
  });

  // Remove any tiles that no longer exist in the light list
  Object.values(existingTiles).forEach(tile => tile.remove());
}

function getRgbLightColorState(light) {
  const cached = rgbLightColorCache.get(String(light.id));
  const hue = Number(light.hue);
  const saturation = Number(light.saturation);
  const colorName = String(light.colorName || '').trim().toLowerCase();

  if (colorName === 'white') {
    const colorState = {
      hue: Number.isFinite(hue) ? Math.max(0, Math.min(100, hue)) : (cached ? cached.hue : 0),
      saturation: 0,
      hex: '#FFFFFF'
    };
    rgbLightColorCache.set(String(light.id), colorState);
    return colorState;
  }

  if ((colorName === 'rgb' || !colorName) &&
    light.hue !== null && light.hue !== undefined &&
    light.saturation !== null && light.saturation !== undefined &&
    Number.isFinite(hue) && Number.isFinite(saturation)) {
    const colorState = {
      hue: Math.max(0, Math.min(100, hue)),
      saturation: Math.max(0, Math.min(100, saturation)),
      hex: hsvToHex(hue, saturation)
    };
    rgbLightColorCache.set(String(light.id), colorState);
    return colorState;
  }

  if (colorName === 'rgb' && cached && cached.saturation === 0) {
    const colorState = { hue: 0, saturation: 100, hex: null };
    rgbLightColorCache.set(String(light.id), colorState);
    return colorState;
  }

  return cached || { hue: 0, saturation: 0, hex: null };
}

function hsvToHex(hue, saturation) {
  const h = ((Number(hue) % 100) + 100) % 100 / 100 * 6;
  const s = Math.max(0, Math.min(100, Number(saturation))) / 100;
  const chroma = s;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const sector = Math.floor(h);
  const [r, g, b] = sector === 0 ? [chroma, x, 0]
    : sector === 1 ? [x, chroma, 0]
      : sector === 2 ? [0, chroma, x]
        : sector === 3 ? [0, x, chroma]
          : sector === 4 ? [x, 0, chroma]
            : [chroma, 0, x];
  const toHex = value => Math.round((value + 1 - chroma) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function openRgbColorModal(light) {
  if (!light) return;

  const modal = document.getElementById('rgbColorModal');
  const slider = modal.querySelector('.rgb-modal-hue-slider');
  const title = modal.querySelector('.rgb-modal-title');
  const colorState = getRgbLightColorState(light);
  const hue = light.hue !== null && light.hue !== undefined && Number.isFinite(Number(light.hue))
    ? Number(light.hue)
    : colorState.hue;

  modal.rgbLight = light;
  title.textContent = light.name || light.label || `Light ${light.id}`;
  slider.value = String(Math.max(0, Math.min(100, hue)));
  updateRgbModalPreview(modal, Number(slider.value));
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  modal.querySelector('.rgb-modal-close').focus();
}

function updateRgbModalPreview(modal, hue) {
  const color = hsvToHex(hue, 100);
  modal.querySelector('.rgb-modal-preview').style.backgroundColor = color;
  modal.querySelector('.rgb-modal-hex').textContent = color;
  modal.querySelector('.rgb-modal-hue-value').textContent = `${Math.round(hue * 3.6)}°`;
  modal.style.setProperty('--modal-hue', String(hue * 3.6));
}

function closeRgbColorModal() {
  const modal = document.getElementById('rgbColorModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  modal.rgbLight = null;
}

function setupRgbColorModal() {
  if (document.getElementById('rgbColorModal')) return;

  const modal = document.createElement('div');
  modal.id = 'rgbColorModal';
  modal.className = 'rgb-modal-backdrop';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <section class="rgb-modal-card" role="dialog" aria-modal="true" aria-labelledby="rgbModalTitle">
      <header class="rgb-modal-header">
        <h2 class="rgb-modal-title" id="rgbModalTitle">RGB Light</h2>
        <button class="rgb-modal-close" type="button" aria-label="Close color selector">&times;</button>
      </header>
      <button class="rgb-white-swatch" type="button">
        <span class="rgb-white-chip" aria-hidden="true"></span>
        <span>Set white</span>
      </button>
      <div class="rgb-modal-selected">
        <span class="rgb-modal-preview" aria-hidden="true"></span>
        <span class="rgb-modal-hex">#FFFFFF</span>
      </div>
      <div class="rgb-modal-hue-area">
        <label for="rgbModalHue">Choose a color</label>
        <input class="rgb-modal-hue-slider" id="rgbModalHue" type="range" min="0" max="100" step="1" value="0" aria-label="Choose light hue">
        <div class="rgb-modal-hue-scale"><span>Red</span><span>Green</span><span>Blue</span><span>Red</span></div>
        <span class="rgb-modal-hue-value">0°</span>
      </div>
      <footer class="rgb-modal-actions">
        <button class="rgb-modal-cancel" type="button">Cancel</button>
        <button class="rgb-modal-apply" type="button">Apply color</button>
      </footer>
    </section>
  `;
  document.body.appendChild(modal);

  const slider = modal.querySelector('.rgb-modal-hue-slider');
  slider.addEventListener('input', () => updateRgbModalPreview(modal, Number(slider.value)));
  modal.querySelector('.rgb-modal-close').addEventListener('click', closeRgbColorModal);
  modal.querySelector('.rgb-modal-cancel').addEventListener('click', closeRgbColorModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeRgbColorModal();
  });
  modal.querySelector('.rgb-white-swatch').addEventListener('click', () => {
    const light = modal.rgbLight;
    if (!light) return;
    const previous = getRgbLightColorState(light);
    const colorState = { hue: previous.hue, saturation: 0, hex: '#FFFFFF' };
    rgbLightColorCache.set(String(light.id), colorState);
    updateRgbTileColor(light.id, colorState);
    setLightColor(light, colorState.hue, 0);
    closeRgbColorModal();
  });
  modal.querySelector('.rgb-modal-apply').addEventListener('click', () => {
    const light = modal.rgbLight;
    if (!light) return;
    const hue = Number(slider.value);
    const colorState = { hue, saturation: 100, hex: hsvToHex(hue, 100) };
    rgbLightColorCache.set(String(light.id), colorState);
    updateRgbTileColor(light.id, colorState);
    setLightColor(light, hue, 100);
    closeRgbColorModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeRgbColorModal();
  });
}

function updateRgbTileColor(deviceId, colorState) {
  const tile = document.querySelector(`[data-device-id="${deviceId}"]`);
  if (!tile) return;
  const swatch = tile.querySelector('.rgb-color-swatch');
  if (!swatch) return;
  swatch.dataset.lastknownhex = colorState.hex || '#ffffff';
  swatch.style.backgroundColor = tile.classList.contains('off') ? '#666' : (colorState.hex || '#6b7280');
  tile.style.setProperty('--light-hue', String(colorState.hue * 3.6));
}

function setLightColor(light, hue, saturation) {
  const argument = {
    hue: Math.round(hue),
    saturation: Math.round(saturation)
  };
  if (light.level !== null && light.level !== undefined && Number.isFinite(Number(light.level))) {
    argument.level = Math.max(0, Math.min(100, Math.round(Number(light.level))));
  }

  uibuilder.send({
    topic: 'control',
    payload: {
      type: 'light',
      deviceId: light.id,
      command: 'setColor',
      argument
    }
  });
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

  const swatch = tile.querySelector('.rgb-color-swatch');
  if (swatch) {
    if(newState == 'on') {
      swatch.style.backgroundColor = swatch.dataset.lastknownhex ?? '#ffffff';
    } else {
      swatch.style.backgroundColor = '#666';
    }
  }

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
  const weatherData = data && typeof data === 'object' ? data : {};
  if (data === null || data === undefined) {
    console.warn('Weather payload unavailable, using placeholder values');
  }

  const tempMain = document.getElementById('currentTemp');
  const weatherDesc = document.getElementById('weatherDesc');
  const feelsLike = document.getElementById('feelsLike');
  const humidity = document.getElementById('humidity');
  const minMax = document.getElementById('minMax');
  const wind = document.getElementById('wind');
  const weatherIcon = document.getElementById('weatherIcon');

  if (!tempMain) return;

  // Update temperature
  tempMain.textContent = (weatherData.temperature !== null && weatherData.temperature !== undefined)
    ? weatherData.temperature + '°C' : '--°C';

  // Update description from Google Weather forecast
  weatherDesc.textContent = weatherData.day_condition || 'Loading...';

  // Update weather icon from Google Weather
  if (weatherIcon) {
    const iconCandidate = typeof weatherData.weather_icon === 'string'
      ? weatherData.weather_icon.trim()
      : '';
    const isUsableIconUrl = /^(https?:\/\/|\/|\.\/|data:image\/)/i.test(iconCandidate);

    if (isUsableIconUrl) {
      weatherIcon.src = iconCandidate.endsWith('.svg') ? iconCandidate : iconCandidate + ".svg";
      weatherIcon.style.display = 'block';
    } else {
      weatherIcon.removeAttribute('src');
      weatherIcon.style.display = 'none';
    }
  }

  // Update feels like
  feelsLike.textContent = (weatherData.apparent_temperature !== null && weatherData.apparent_temperature !== undefined)
    ? weatherData.apparent_temperature + '°C' : '--°C';

  // Update humidity
  humidity.textContent = (weatherData.humidity !== null && weatherData.humidity !== undefined)
    ? weatherData.humidity + '%' : '--%';

  // Update min/max
  const minTemp = (weatherData.min_temperature !== null && weatherData.min_temperature !== undefined)
    ? weatherData.min_temperature : '--';
  const maxTemp = (weatherData.max_temperature !== null && weatherData.max_temperature !== undefined)
    ? weatherData.max_temperature : '--';
  minMax.textContent = `${minTemp}° / ${maxTemp}°`;

  // Update wind with direction arrow
  const windSpeed = (weatherData.wind_speed !== null && weatherData.wind_speed !== undefined)
    ? weatherData.wind_speed : '--';
  const windDirText = weatherData.wind_direction || '';
  const windDirDegrees = weatherData.wind_direction_degrees;

  // Create wind direction arrow
  let windArrow = '';
  if (windDirDegrees !== null && windDirDegrees !== undefined) {
    windArrow = `<span class="wind-arrow" style="display:inline-block; transform:rotate(${windDirDegrees}deg);">↓</span> `;
  }

  wind.innerHTML = `${windArrow}${windSpeed} km/h ${windDirText}`;

  // Update rain chance (from forecast data if available)
  const rainChanceEl = document.getElementById('rainChance');
  if (rainChanceEl) {
    if (weatherData.precipitation_prob_day !== null && weatherData.precipitation_prob_day !== undefined) {
      rainChanceEl.textContent = `${weatherData.precipitation_prob_day}%`;
    } else if (weatherData.rainfall_24hr !== null && weatherData.rainfall_24hr !== undefined) {
      rainChanceEl.textContent = `${weatherData.rainfall_24hr}mm (24h)`;
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
