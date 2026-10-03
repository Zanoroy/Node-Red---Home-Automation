// Dashboard JavaScript using uibuilder
/* globals uibuilder */

// Initialize solar widget
let solarWidget;

// Track recently toggled lights to prevent race condition
const recentlyToggled = new Map();

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function () {
  console.log('Dashboard loaded');
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
    }
    
    // Update timestamp
    updateTimestamp();
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
