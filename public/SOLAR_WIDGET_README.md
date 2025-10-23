# Solar State Widget

A dynamic, responsive solar state widget for dashboard display. The widget automatically adapts to container size changes and displays real-time solar system information.

## Features

- **Dynamic Sizing**: Automatically adjusts all elements (icons, text, tooltips) based on container size
- **Responsive Layout**: Works on all screen sizes from mobile to desktop
- **Real-time Updates**: Update data via JavaScript API
- **Theme Support**: Light and dark theme variants
- **Visual Feedback**: Pulse animation when power is being generated
- **Hover Tooltips**: Additional MPPT information on hover

## Files

- `solar-state-widget.html` - Main widget HTML structure
- `solar-state-widget.css` - Widget styling with responsive design
- `solar-state-widget.js` - JavaScript controller with ResizeObserver
- `solar-state-widget-demo.html` - Interactive demo page

## Installation

1. Copy all widget files to your Node-RED public directory:
   ```
   /root/.node-red/public/
   ```

2. Ensure the images directory exists with the required solar icon:
   ```
   /root/.node-red/public/images/state_solor.png
   ```

## Usage

### Basic Integration

Include the widget in your dashboard:

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="solar-state-widget.css">
</head>
<body>
    <div id="solarStateWidget" class="solar-widget-container" style="width: 400px; height: 400px;">
        <div class="solar-icon-wrapper">
            <div class="icon state_solor"></div>
        </div>
        <div class="status-text">
            <span class="label">System Status:</span>
            <span class="value" id="systemStatus">On-Grid mode</span>
        </div>
        <div class="power-display">
            <span class="label">PV Power:</span>
            <span class="value" id="pvPower">0.00kW</span>
        </div>
        <div class="priority-mode">
            <span class="value" id="priorityMode">Load First</span>
        </div>
    </div>
    
    <script src="solar-state-widget.js"></script>
</body>
</html>
```

### JavaScript API

Initialize and control the widget:

```javascript
// Initialize widget
const widget = new SolarStateWidget('solarStateWidget');

// Update widget data
widget.updateData({
    systemStatus: 'On-Grid mode',
    pvPower: 3.5,              // in kW
    priorityMode: 'Load First',
    vPv1: 368.9,               // MPPT1 voltage
    pPv1: 1400,                // MPPT1 power in W
    vPv2: 319.7,               // MPPT2 voltage
    pPv2: 1100                 // MPPT2 power in W
});

// Change theme
widget.setLightTheme(true);  // or false for dark theme

// Clean up when done
widget.destroy();
```

### Node-RED Integration

In your Node-RED flow, create a template node with:

```html
<div id="solarWidget" class="solar-widget-container" style="width: 100%; height: 400px;">
    <!-- Widget HTML structure here -->
</div>

<script>
    (function() {
        const widget = new SolarStateWidget('solarWidget');
        
        // Listen for Node-RED messages
        scope.$watch('msg', function(msg) {
            if (msg && msg.payload) {
                widget.updateData({
                    systemStatus: msg.payload.status,
                    pvPower: msg.payload.power / 1000,  // Convert W to kW
                    priorityMode: msg.payload.mode,
                    vPv1: msg.payload.mppt1.voltage,
                    pPv1: msg.payload.mppt1.power,
                    vPv2: msg.payload.mppt2.voltage,
                    pPv2: msg.payload.mppt2.power
                });
            }
        });
    })();
</script>
```

### UI Builder Integration

For Node-RED's UIBuilder:

1. Copy widget files to your UIBuilder instance folder
2. Include CSS and JS in your index.html:

```html
<link rel="stylesheet" href="solar-state-widget.css">
<script src="solar-state-widget.js"></script>
```

3. Use the widget and connect to UIBuilder's message system:

```javascript
uibuilder.onChange('msg', function(msg) {
    if (msg.topic === 'solar-update') {
        window.solarStateWidget.updateData(msg.payload);
    }
});
```

## Dynamic Sizing

The widget uses ResizeObserver to automatically adjust when the container size changes:

- **Font sizes** scale from 10px to 24px based on container dimensions
- **Icon size** adjusts between 80px and 200px
- **Layout positions** adapt for small (< 300px) and large (> 600px) heights
- **All elements** maintain proper proportions at any size

You can resize the widget container, and everything will adjust automatically:

```javascript
// Widget automatically adjusts to new size
document.getElementById('solarStateWidget').style.width = '600px';
document.getElementById('solarStateWidget').style.height = '600px';
```

## Customization

### Change Colors

Edit `solar-state-widget.css`:

```css
.solar-widget-container {
    background: rgba(0, 0, 0, 0.16);  /* Container background */
}

.status-text .value {
    color: #FFF;  /* Status text color */
}
```

### Add More Data Fields

1. Add HTML element in the widget structure
2. Position it using absolute positioning in CSS
3. Update the `updateData()` method in JavaScript to handle the new field

### Custom Animation

Modify the pulse animation in CSS:

```css
@keyframes pulse {
    0%, 100% { 
        opacity: 1; 
        transform: translate(-50%, -50%) scale(1); 
    }
    50% { 
        opacity: 0.8; 
        transform: translate(-50%, -50%) scale(1.1); 
    }
}
```

## Demo

Open `solar-state-widget-demo.html` in a browser to see:
- Three different widget sizes (small, medium, large)
- Interactive controls to update widget data
- Theme switching
- Data simulation

## Browser Support

- Modern browsers with ResizeObserver support (Chrome 64+, Firefox 69+, Safari 13.1+)
- Fallback to window resize events for older browsers
- Responsive design works on all screen sizes

## Data Format

The widget expects data in this format:

```javascript
{
    systemStatus: "On-Grid mode",  // String: system operating mode
    pvPower: 3.5,                  // Number: PV power in kW
    priorityMode: "Load First",    // String: priority setting
    vPv1: 368.9,                   // Number: MPPT1 voltage
    pPv1: 1400,                    // Number: MPPT1 power in W
    vPv2: 319.7,                   // Number: MPPT2 voltage
    pPv2: 1100                     // Number: MPPT2 power in W
}
```

## Troubleshooting

**Widget not resizing:**
- Ensure container has explicit width/height
- Check browser console for ResizeObserver errors
- Verify JavaScript is loaded after DOM

**Image not displaying:**
- Check image path: `images/state_solor.png`
- Verify image file exists in public directory
- Check browser console for 404 errors

**Data not updating:**
- Verify widget instance is initialized
- Check `updateData()` is called with valid data object
- Inspect browser console for JavaScript errors

## License

This widget is part of the Node-RED Home Automation project.
