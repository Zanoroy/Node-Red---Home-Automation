// Dashboard JavaScript using uibuilder
/* globals uibuilder */

// Initialize solar widget
let solarWidget;

// Track recently toggled lights to prevent race condition
const recentlyToggled = new Map();

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function () {
  console.log('Dashboard loaded');

  // Initialize solar widget
  initializeSolarWidget();

  // Setup uibuilder
  setupUibuilder();
});

// Initialize Solar State Widget
function initializeSolarWidget() {
  try {
    // Check if SolarStateWidget class is available
    if (typeof SolarStateWidget !== 'undefined') {
      solarWidget = new SolarStateWidget('solarWidget');
      console.log('Solar widget initialized');
    } else {
      console.warn('SolarStateWidget class not found');
    }
  } catch (error) {
    console.error('Error initializing solar widget:', error);
  }
}

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

    if (msg.topic === 'lights') {
      updateLights(msg.payload);
    } else if (msg.topic === 'battery') {
      updateBattery(msg.payload);
    } else if (msg.topic === 'weather') {
      updateWeather(msg.payload);
    } else if (msg.topic === 'solar') {
      updateSolarWidget(msg.payload);
    }

    // Update timestamp
    updateTimestamp();
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

// Request initial data
setTimeout(() => {
  uibuilder.send({
    topic: 'request',
    payload: 'initialData'
  });
}, 1000);

console.log('Dashboard script initialized');
