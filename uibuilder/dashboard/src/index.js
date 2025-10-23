// Dashboard JavaScript using uibuilder
/* globals uibuilder */

// Initialize solar widget
let solarWidget;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
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
    uibuilder.onChange('ioConnected', function(connected) {
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
    uibuilder.onChange('msg', function(msg) {
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
    
    // Clear existing lights
    grid.innerHTML = '';
    
    // Add each light
    lights.forEach(light => {
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
    });
}

// Toggle Light
function toggleLight(deviceId, currentState) {
    const tile = document.querySelector(`[data-device-id="${deviceId}"]`);
    if (!tile) return;
    
    const newState = currentState === 'on' ? 'off' : 'on';
    
    // Add loading state
    tile.classList.add('loading');
    
    // Send command to Node-RED
    uibuilder.send({
        topic: 'control',
        payload: {
            type: 'light',
            deviceId: deviceId,
            command: newState
        }
    });
    
    // Optimistic UI update
    setTimeout(() => {
        tile.classList.remove('on', 'off', 'loading');
        tile.classList.add(newState);
        tile.onclick = () => toggleLight(deviceId, newState);
    }, 500);
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
    
    // Update description
    weatherDesc.textContent = data.cloud_description || 'No data';
    
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
    
    // Update wind
    const windSpeed = (data.wind_speed !== null && data.wind_speed !== undefined) 
        ? data.wind_speed : '--';
    const windDir = data.wind_direction || '';
    wind.textContent = `${windSpeed} km/h ${windDir}`;
    
    // Update icon
    if (data.cloud_description && weatherIcon) {
        const hour = new Date().getHours();
        const isDayTime = hour >= 6 && hour < 18;
        let iconUrl = '';
        
        if (data.cloud_description.startsWith('Mostly ')) {
            iconUrl = isDayTime ? 
                'http://reg.bom.gov.au/weather-services/images/symbols/large/partly-cloudy.png' :
                'http://reg.bom.gov.au/weather-services/images/symbols/large/partly-cloudy-night.png';
        } else {
            const iconName = data.cloud_description.toLowerCase().replace(/\s+/g, '-');
            iconUrl = `http://reg.bom.gov.au/weather-services/images/symbols/large/${iconName}.png`;
        }
        
        weatherIcon.src = iconUrl;
        weatherIcon.style.display = 'block';
        weatherIcon.onerror = function() { this.style.display = 'none'; };
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
            second: '2-digit'
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
