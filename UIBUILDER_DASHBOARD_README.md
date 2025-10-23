# UIBuilder Dashboard Setup

## Overview
Complete home automation dashboard using `node-red-contrib-uibuilder` with:
- Solar State Widget (energy flow visualization)
- Light controls (Hubitat integration)
- Battery status display
- Weather information
- Real-time updates via WebSocket

## Installation Steps

### Option A: Manual Setup (Recommended)

#### 1. Create UIBuilder Instance
1. Open Node-RED: `http://172.17.254.10:1880`
2. Create a new flow tab called "UIBuilder Dashboard"
3. Drag a **uibuilder** node from the palette onto the canvas
4. Double-click the uibuilder node to configure it:
   - **Name**: `Home Dashboard`
   - **URL**: `dashboard` (IMPORTANT: must be exactly "dashboard")
   - **Template**: Leave as default or select "Blank"
   - Click "Done"
5. Click "Deploy"

#### 2. Verify Files Are In Place
The dashboard files are already created in:
```
/root/.node-red/uibuilder/dashboard/src/
```

If the uibuilder node created different folders, you may need to move files:
```bash
cd /root/.node-red
# Check what uibuilder created
ls -la uibuilder/

# If it created a different folder, copy our files
cp -r uibuilder/dashboard/* uibuilder/[your-folder-name]/
```

#### 3. Import Supporting Flow Nodes
1. Click menu (≡) → Import
2. Copy and paste the flow from `/root/.node-red/uibuilder-dashboard-flow.json`
3. Look for the uibuilder node (will show an error)
4. Delete the imported uibuilder node
5. Connect your manually-created uibuilder node to the flow
6. Click "Deploy"

### Option B: Quick Start (If you see errors)

If the uibuilder node shows `<no url>` error:

1. **Delete the imported flow** (if you imported it)
2. **In Node-RED UI**, drag a fresh uibuilder node
3. **Configure it**:
   - URL: `dashboard`
   - Name: `Home Dashboard`
4. **Edit the node** → Click "Edit files" button
5. **Copy the contents** from our pre-made files:
   - Copy `/root/.node-red/uibuilder/dashboard/src/index.html` → paste in editor
   - Copy `/root/.node-red/uibuilder/dashboard/src/index.css` → paste in editor  
   - Copy `/root/.node-red/uibuilder/dashboard/src/index.js` → paste in editor
6. **Save** and **Deploy**

### 4. Test Access
Once deployed, access your dashboard at:
```
http://172.17.254.10:1880/dashboard
```

### 4. Access Dashboard
Open your browser to:
```
http://172.17.254.10:1880/dashboard
```

## File Structure
```
/root/.node-red/uibuilder/dashboard/
├── src/
│   ├── index.html    # Main dashboard HTML
│   ├── index.css     # Dashboard styles
│   └── index.js      # Dashboard JavaScript logic
└── dist/             # Auto-deployed files (generated)
```

## Features

### Solar State Widget
- Real-time energy flow visualization
- Animated flow lines showing power direction
- 5 system components: Solar, System, Battery, Load, Grid
- Dynamic sizing and responsive design
- Power values in kW
- Battery SOC percentage

### Light Controls
- Grid layout with material design cards
- Toggle lights on/off with single click
- Visual feedback (loading states, animations)
- Glowing effect when lights are on
- Optimistic UI updates

### Battery Status
- Visual battery indicator
- Color-coded levels (red < 20%, green > 80%)
- Charging/discharging animations
- Real-time SOC percentage
- Flash animation when discharging

### Weather Display
- Current temperature and conditions
- Feels-like temperature
- Min/Max temperatures
- Humidity and wind information
- Weather icons from BOM

## Data Sources

The dashboard automatically pulls data from your existing Node-RED flows:

- **Lights**: `global.hubitatLights` (updated every 5s)
- **Battery**: `global.batteryData` (updated every 5s)
- **Weather**: `global.weather_data` (updated every 30s)
- **Solar**: `global.powerGraphData` (updated every 2s)

## Communication Flow

```
Browser <--WebSocket--> UIBuilder Node <--> Node-RED Flow <--> Devices
```

### Outgoing (Browser → Node-RED)
- Light control commands
- Data refresh requests

### Incoming (Node-RED → Browser)
- Light states (topic: 'lights')
- Battery data (topic: 'battery')
- Weather data (topic: 'weather')
- Solar data (topic: 'solar')

## Customization

### Update Polling Intervals
Edit the inject nodes in the flow:
- Lights: 5 seconds
- Battery: 5 seconds
- Weather: 30 seconds
- Solar: 2 seconds

### Modify Light Device IDs
Edit the "Filter & Format Lights" function node:
```javascript
const targetIds = [17, 1, 2, 3, 4, 20, 5]; // Your device IDs
```

### Change Colors/Styling
Edit `/root/.node-red/uibuilder/dashboard/src/index.css`:
```css
:root {
    --accent-color: #ffd700;  /* Change accent color */
    --success-color: #00ff00;  /* Change success color */
    /* etc... */
}
```

### Add New Widgets
1. Add HTML in `index.html`
2. Add styles in `index.css`
3. Add logic in `index.js`
4. Add data handling in the Node-RED flow

## Advantages over node-red-dashboard

✅ **Full Control**: Complete HTML/CSS/JS control
✅ **Modern UI**: Custom animations, gradients, responsive design
✅ **Better Performance**: Direct WebSocket communication
✅ **No Deprecation**: Actively maintained
✅ **Easy Integration**: Works with your existing widgets
✅ **Scalable**: Can grow with your needs

## Troubleshooting

### Dashboard Not Loading
1. Check Node-RED is running
2. Verify deployment was successful
3. Check browser console for errors (F12)
4. Verify uibuilder node is deployed

### No Data Showing
1. Check your other flows are running (Solar Info, BOM Weather, Hubitat)
2. Verify global context variables are set:
   - `global.hubitatLights`
   - `global.batteryData`
   - `global.weather_data`
   - `global.powerGraphData`

### Solar Widget Not Displaying
1. Verify solar-state-widget files exist in `/root/.node-red/public/`
2. Check browser console for script loading errors
3. Ensure Node-RED is serving the `/public/` directory

### Lights Not Toggling
1. Verify Hubitat hub is accessible
2. Check access token is valid
3. Check device IDs are correct
4. Look at Node-RED debug output

## Performance Tips

- Dashboard uses WebSocket for real-time updates (low overhead)
- Optimistic UI updates for instant feedback
- Efficient CSS animations (GPU accelerated)
- Debounced updates prevent flooding

## Browser Compatibility

✅ Chrome/Edge (recommended)
✅ Firefox
✅ Safari
✅ Mobile browsers

## Security Note

This dashboard is designed for internal network use. For external access:
1. Use Node-RED authentication
2. Configure HTTPS
3. Use a VPN or reverse proxy
4. Implement rate limiting

## Support

For issues specific to:
- **UIBuilder**: https://github.com/TotallyInformation/node-red-contrib-uibuilder
- **Node-RED**: https://discourse.nodered.org/

Enjoy your new dashboard! 🎉
