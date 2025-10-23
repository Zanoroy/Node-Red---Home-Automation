# Solar State Widget - Quick Start Guide

## What Was Created

A fully responsive solar state widget that displays:
- Solar panel icon (state_solor.png)
- System status (On-Grid mode, etc.)
- PV Power output in kW
- Priority mode (Load First, etc.)
- Optional MPPT data on hover

## Files Created

1. **solar-state-widget.html** - Main widget HTML structure
2. **solar-state-widget.css** - Responsive CSS styling
3. **solar-state-widget.js** - Dynamic sizing JavaScript controller
4. **solar-state-widget-demo.html** - Interactive demo page
5. **solar-widget-dashboard-template.html** - Node-RED dashboard integration template
6. **SOLAR_WIDGET_README.md** - Complete documentation

## Quick Integration Options

### Option 1: Standalone HTML Page

Open `solar-state-widget.html` in a browser or serve it through Node-RED.

### Option 2: Node-RED Dashboard

1. Add a **Template** node to your flow
2. Copy contents from `solar-widget-dashboard-template.html`
3. Send data to the template:

```javascript
msg.payload = {
    systemStatus: "On-Grid mode",
    pvPower: 3.5,
    priorityMode: "Load First"
};
return msg;
```

### Option 3: Custom Dashboard Integration

Include in your dashboard HTML:

```html
<link rel="stylesheet" href="solar-state-widget.css">
<script src="solar-state-widget.js"></script>

<div id="solarWidget" class="solar-widget-container" style="width: 400px; height: 400px;">
    <!-- Widget HTML -->
</div>

<script>
    const widget = new SolarStateWidget('solarWidget');
    widget.updateData({
        systemStatus: "On-Grid mode",
        pvPower: 3.5,
        priorityMode: "Load First"
    });
</script>
```

## Testing the Widget

### View the Demo

1. Open browser to: `http://your-node-red-server:1880/public/solar-state-widget-demo.html`
2. Use controls to update widget data
3. Resize browser window to see responsive behavior
4. Toggle theme and simulate data

### Test in Node-RED

1. Import a simple flow:

```json
[
    {
        "id": "inject1",
        "type": "inject",
        "name": "Send Solar Data",
        "topic": "",
        "payload": "{\"systemStatus\":\"On-Grid mode\",\"pvPower\":3.5,\"priorityMode\":\"Load First\"}",
        "payloadType": "json",
        "repeat": "5",
        "once": true
    },
    {
        "id": "template1",
        "type": "ui_template",
        "name": "Solar Widget",
        "group": "dashboard_group",
        "template": "<!-- Copy from solar-widget-dashboard-template.html -->"
    }
]
```

## Key Features

### ✅ Dynamic Sizing
- Automatically adjusts to container size
- Font sizes scale from 10px to 24px
- Icon scales from 80px to 200px
- Layout adapts for different heights

### ✅ Responsive Design
- Works on mobile, tablet, desktop
- CSS breakpoints for different screen sizes
- Maintains proportions at all sizes

### ✅ Real-time Updates
- Update via JavaScript API
- Compatible with Node-RED message flow
- Smooth transitions between states

### ✅ Visual Feedback
- Pulse animation when generating power
- Hover tooltips for additional data
- Theme switching (light/dark)

## Data Format

Send data in this format:

```javascript
{
    systemStatus: "On-Grid mode",    // System operating mode
    pvPower: 3.5,                    // Power in kW
    priorityMode: "Load First",      // Priority setting
    vPv1: 368.9,                     // MPPT1 voltage (optional)
    pPv1: 1400,                      // MPPT1 power in W (optional)
    vPv2: 319.7,                     // MPPT2 voltage (optional)
    pPv2: 1100                       // MPPT2 power in W (optional)
}
```

## Customization

### Change Size
```css
.solar-widget-container {
    width: 500px;
    height: 500px;
}
```

### Change Colors
```css
.solar-widget-container {
    background: rgba(0, 0, 0, 0.3);  /* Darker background */
}

.value {
    color: #00ff00;  /* Green text */
}
```

### Modify Animation Speed
```css
@keyframes pulse {
    /* Adjust animation duration */
}

.active .icon {
    animation: pulse 3s ease-in-out infinite;  /* Slower pulse */
}
```

## Troubleshooting

**Widget not displaying:**
- Check image path: `/images/state_solor.png` exists
- Verify CSS and JS files are loaded
- Check browser console for errors

**Not resizing properly:**
- Ensure container has width/height set
- Check ResizeObserver is supported (modern browsers)
- Verify JavaScript is loaded

**Data not updating:**
- Check msg.payload format
- Verify element IDs match
- Look for JavaScript errors in console

## Next Steps

1. **Test the demo**: Open `solar-state-widget-demo.html`
2. **Integrate in dashboard**: Use template from `solar-widget-dashboard-template.html`
3. **Connect data source**: Link to your solar inverter data
4. **Customize styling**: Edit CSS to match your theme
5. **Add more widgets**: Create battery, grid, load widgets using same pattern

## Support Files

All files are in: `/root/.node-red/public/`

- Full documentation: `SOLAR_WIDGET_README.md`
- Demo page: `solar-state-widget-demo.html`
- Dashboard template: `solar-widget-dashboard-template.html`

## Example Node-RED Flow

```
[Inject Node] → [Function Node] → [Template Node with Widget]
                       ↓
            Format data as JSON payload
```

Function node code:
```javascript
msg.payload = {
    systemStatus: "On-Grid mode",
    pvPower: parseFloat((Math.random() * 5).toFixed(2)),
    priorityMode: "Load First",
    vPv1: 368.9,
    pPv1: 1400,
    vPv2: 319.7,
    pPv2: 1100
};
return msg;
```

---

**Created:** October 24, 2025
**Location:** `/root/.node-red/public/`
**Template Source:** `solarlayout.html` and `panel.css`
