/**
 * Solar State Widget - Dynamic Sizing Controller
 * Automatically adjusts widget elements based on container size
 */

class SolarStateWidget {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      console.error(`SolarStateWidget: Container with id '${containerId}' not found`);
      return;
    }

    // Get all icon wrappers
    this.solarIcon = this.container.querySelector('.solar-position');
    this.systemIcon = this.container.querySelector('.system-position');
    this.batteryIcon = this.container.querySelector('.battery-position');
    this.loadIcon = this.container.querySelector('.load-position');
    this.gridIcon = this.container.querySelector('.grid-position');

    // Get all flow lines
    this.solarToSystem = this.container.querySelector('.solar-to-system');
    this.batteryToSystem = this.container.querySelector('.battery-to-system');
    this.systemToGrid = this.container.querySelector('.system-to-grid');
    this.systemToLoad = this.container.querySelector('.system-to-load');

    // Get timestamp element
    this.timestampElement = this.container.querySelector('.widget-timestamp');

    this.resizeObserver = null;
    this.resizeHandler = () => this.handleResize();
    this.init();
  }

  init() {
    if (!this.container) return;

    // Set up resize observer for dynamic resizing
    this.setupResizeObserver();

    // Initial resize
    this.handleResize();

    // Add window resize listener as fallback
    window.addEventListener('resize', this.resizeHandler);
  }

  setupResizeObserver() {
    if (!this.container) return;

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          this.handleResize();
        }
      });

      this.resizeObserver.observe(this.container);
    }
  }

  handleResize() {
    if (!this.container) return;

    const width = this.container.offsetWidth;
    const height = this.container.offsetHeight;

    // Calculate base font size based on container dimensions
    const baseFontSize = Math.min(width, height) * 0.022; // 2.2% of smallest dimension
    const clampedFontSize = Math.max(10, Math.min(baseFontSize, 20)); // Clamp between 10px and 20px

    // Apply dynamic font sizing
    this.container.style.fontSize = `${clampedFontSize}px`;

    // Icon size adjustment is now handled by CSS percentages
    // but we can add fine-tuning here if needed

    // Adjust flow line thickness based on size
    const flowLines = this.container.querySelectorAll('.flow-line');
    const lineThickness = Math.max(2, Math.min(clampedFontSize * 0.15, 4));
    flowLines.forEach(line => {
      if (line.classList.contains('vertical')) {
        line.style.width = `${lineThickness}px`;
      } else {
        line.style.height = `${lineThickness}px`;
      }
    });
  }

  /**
   * Update widget data
   * @param {Object} data - Object containing widget data
   */
  updateData(data) {
    // Check if data is stale (older than 5 minutes)
    const isOffline = this.checkDataFreshness(data.timestamp);
    
    // Update offline state
    if (isOffline) {
      this.container.classList.add('offline');
    } else {
      this.container.classList.remove('offline');
    }
    
    // System Status
    const statusElement = document.getElementById('systemStatus');
    if (statusElement) {
      if (isOffline) {
        statusElement.textContent = 'OFFLINE';
      } else if (data.systemStatus) {
        statusElement.textContent = data.systemStatus;
      }
    }

    // PV Power
    if (data.pvPower !== undefined) {
      const pvPowerElement = document.getElementById('pvPower');
      if (pvPowerElement) {
        pvPowerElement.textContent = `${data.pvPower.toFixed(2)}kW`;
      }

      // Activate solar icon and flow if generating
      if (this.solarIcon) {
        if (data.pvPower > 0) {
          this.solarIcon.classList.add('active');
        } else {
          this.solarIcon.classList.remove('active');
        }
      }

      // Activate solar to system flow
      if (this.solarToSystem) {
        if (data.pvPower > 0) {
          this.solarToSystem.classList.add('active');
        } else {
          this.solarToSystem.classList.remove('active');
        }
      }
    }

    // Battery Power (positive = charging, negative = discharging)
    if (data.batteryPower !== undefined) {
      const batteryPowerElement = document.getElementById('batteryPower');
      const batteryLabel = batteryPowerElement ? batteryPowerElement.previousElementSibling : null;

      if (batteryPowerElement) {
        const absPower = Math.abs(data.batteryPower);
        batteryPowerElement.textContent = `${absPower.toFixed(2)}kW`;
      }

      if (batteryLabel) {
        batteryLabel.textContent = data.batteryPower > 0 ? 'Charging:' : 'Discharging:';
      }

      // Handle battery flow line
      if (this.batteryToSystem) {
        // Remove all battery flow classes first
        this.batteryToSystem.classList.remove('active', 'charging', 'discharging-low', 'discharging-high');
        
        if (Math.abs(data.batteryPower) > 0) {
          this.batteryToSystem.classList.add('active');
          
          if (data.batteryPower > 0) {
            // Charging: green, flow toward battery (reverse)
            this.batteryToSystem.classList.add('charging');
          } else {
            // Discharging: orange if SOC > 50, red if SOC <= 50
            const soc = data.batterySoc || 50;
            if (soc <= 50) {
              this.batteryToSystem.classList.add('discharging-low'); // Red
            } else {
              this.batteryToSystem.classList.add('discharging-high'); // Orange
            }
          }
        }
      }

      // Activate battery icon
      if (this.batteryIcon && Math.abs(data.batteryPower) > 0) {
        this.batteryIcon.classList.add('active');
      } else if (this.batteryIcon) {
        this.batteryIcon.classList.remove('active');
      }
    }

    // Battery SoC
    if (data.batterySoc !== undefined) {
      const socElement = document.getElementById('batterySoc');
      if (socElement) socElement.textContent = `${data.batterySoc}%`;
    }

    // Load Power
    if (data.consumption !== undefined) {
      const loadElement = document.getElementById('powerConsumption');
      if (loadElement) {
        loadElement.textContent = `${data.consumption.toFixed(2)}kW`;
      }

      // Activate system to load flow
      if (this.systemToLoad && data.consumption > 0) {
        this.systemToLoad.classList.add('active', 'consumption');
      } else if (this.systemToLoad) {
        this.systemToLoad.classList.remove('active', 'consumption');
      }

      // Activate load icon
      if (this.loadIcon && data.consumption > 0) {
        this.loadIcon.classList.add('active');
      } else if (this.loadIcon) {
        this.loadIcon.classList.remove('active');
      }
    }

    // Grid Power (positive = import, negative = export)
    if (data.gridPower !== undefined) {
      const gridPowerElement = document.getElementById('gridPower');
      const gridLabel = document.getElementById('gridLabel');

      const absPower = Math.abs(data.gridPower);
      if (gridPowerElement) {
        gridPowerElement.textContent = `${absPower.toFixed(2)}kW`;
      }

      if (gridLabel) {
        gridLabel.textContent = data.gridPower >= 0 ? 'Import:' : 'Export:';
      }

      // Handle grid flow line
      if (this.systemToGrid) {
        // Remove all grid flow classes first
        this.systemToGrid.classList.remove('active', 'grid-import', 'grid-export');
        
        if (data.gridPower > 0) {
          // Export: red, flow away from grid (up)
          this.systemToGrid.classList.add('active', 'grid-export');
        } else if (data.gridPower < 0) {
          // Import: green, flow toward grid (down)
          this.systemToGrid.classList.add('active', 'grid-import');
        }
        // If gridPower == 0, flow remains inactive (no classes added)
      }

      // Activate grid icon
      if (this.gridIcon && Math.abs(data.gridPower) > 0) {
        this.gridIcon.classList.add('active');
      } else if (this.gridIcon) {
        this.gridIcon.classList.remove('active');
      }
    }

    // Priority Mode
    if (data.priorityMode) {
      const priorityElement = document.getElementById('priorityMode');
      if (priorityElement) priorityElement.textContent = data.priorityMode;
    }

    // Update timestamp
    if (data.timestamp && this.timestampElement) {
      this.timestampElement.textContent = this.formatTimestamp(data.timestamp);
    }

    // Activate system icon if any power flowing
    if (this.systemIcon) {
      const anyPower = (data.pvPower && data.pvPower > 0) ||
        (data.batteryPower && Math.abs(data.batteryPower) > 0) ||
        (data.consumption && data.consumption > 0) ||
        (data.gridPower && Math.abs(data.gridPower) > 0);

      if (anyPower) {
        this.systemIcon.classList.add('active');
      } else {
        this.systemIcon.classList.remove('active');
      }
    }
  }

  /**
   * Check if data timestamp is fresh (less than 5 minutes old)
   * @param {String} isoString - ISO formatted timestamp string (UTC)
   * @returns {Boolean} true if data is stale (offline), false if fresh
   */
  checkDataFreshness(isoString) {
    if (!isoString) return true; // No timestamp = offline
    
    try {
      const dataTime = new Date(isoString);
      const now = new Date();
      const ageMinutes = (now - dataTime) / 1000 / 60;
      
      // Data is stale if older than 5 minutes
      return ageMinutes > 5;
    } catch (error) {
      console.error('Error checking data freshness:', error);
      return true; // Assume offline on error
    }
  }

  /**
   * Format timestamp from UTC ISO string to local timezone
   * @param {String} isoString - ISO formatted timestamp string (UTC)
   * @returns {String} Formatted timestamp in YYYY/MM/DD HH:mm:ss
   */
  formatTimestamp(isoString) {
    try {
      const date = new Date(isoString);
      
      // Format as YYYY/MM/DD HH:mm:ss in local timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  }

  /**
   * Enable/disable light color theme
   * @param {Boolean} isLight - Whether to use light theme
   */
  setLightTheme(isLight) {
    if (isLight) {
      this.container.classList.add('lightColor');
    } else {
      this.container.classList.remove('lightColor');
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const widgetElement = document.getElementById('solarStateWidget');

  // Only initialize if the element exists
  if (widgetElement) {
    const widget = new SolarStateWidget('solarStateWidget');

    // Example: Update data every 5 seconds (replace with actual data source)
    setInterval(() => {
      // Simulated data - replace with actual data from your system
      const mockData = {
        systemStatus: 'On-Grid mode',
        pvPower: Math.random() * 5, // Random power 0-5kW
        priorityMode: 'Load First',
        vPv1: 350 + Math.random() * 50,
        pPv1: Math.random() * 2000,
        vPv2: 300 + Math.random() * 50,
        pPv2: Math.random() * 2000
      };

      widget.updateData(mockData);
    }, 5000);

    // Make widget globally accessible
    window.solarStateWidget = widget;
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SolarStateWidget;
}
