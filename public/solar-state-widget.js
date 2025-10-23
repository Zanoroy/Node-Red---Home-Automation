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
        // System Status
        if (data.systemStatus) {
            const statusElement = document.getElementById('systemStatus');
            if (statusElement) statusElement.textContent = data.systemStatus;
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
        
        // Battery Power (positive = discharging, negative = charging)
        if (data.batteryPower !== undefined) {
            const batteryPowerElement = document.getElementById('batteryPower');
            const batteryLabel = batteryPowerElement ? batteryPowerElement.previousElementSibling : null;
            
            if (batteryPowerElement) {
                const absPower = Math.abs(data.batteryPower);
                batteryPowerElement.textContent = `${absPower.toFixed(2)}kW`;
            }
            
            if (batteryLabel) {
                batteryLabel.textContent = data.batteryPower >= 0 ? 'Discharging:' : 'Charging:';
            }
            
            // Activate battery flow
            if (this.batteryToSystem && Math.abs(data.batteryPower) > 0) {
                this.batteryToSystem.classList.add('active');
            } else if (this.batteryToSystem) {
                this.batteryToSystem.classList.remove('active');
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
        if (data.loadPower !== undefined) {
            const loadElement = document.getElementById('loadPower');
            if (loadElement) {
                loadElement.textContent = `${data.loadPower.toFixed(2)}kW`;
            }
            
            // Activate system to load flow
            if (this.systemToLoad && data.loadPower > 0) {
                this.systemToLoad.classList.add('active');
            } else if (this.systemToLoad) {
                this.systemToLoad.classList.remove('active');
            }
            
            // Activate load icon
            if (this.loadIcon && data.loadPower > 0) {
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
            
            // Activate system to grid flow
            if (this.systemToGrid && Math.abs(data.gridPower) > 0) {
                this.systemToGrid.classList.add('active');
            } else if (this.systemToGrid) {
                this.systemToGrid.classList.remove('active');
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
        
        // Activate system icon if any power flowing
        if (this.systemIcon) {
            const anyPower = (data.pvPower && data.pvPower > 0) || 
                           (data.batteryPower && Math.abs(data.batteryPower) > 0) ||
                           (data.loadPower && data.loadPower > 0) ||
                           (data.gridPower && Math.abs(data.gridPower) > 0);
            
            if (anyPower) {
                this.systemIcon.classList.add('active');
            } else {
                this.systemIcon.classList.remove('active');
            }
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
