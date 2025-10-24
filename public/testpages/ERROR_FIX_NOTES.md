# Solar Widget - Error Fix Applied

## Issue Fixed
**Error:** `TypeError: can't access property "querySelector", this.container is null`

## Root Cause
The widget JavaScript was trying to initialize before the DOM element existed, or the element ID didn't match.

## Changes Made

### 1. solar-state-widget.js
✅ Added null check in constructor
✅ Added error logging when container not found
✅ Added safety checks in all methods
✅ Fixed event listener cleanup
✅ Added element existence check before initialization

### 2. solar-widget-dashboard-template.html
✅ Added retry logic if element not found
✅ Added null checks for all element access
✅ Added proper initialization timing
✅ Better error handling

## Testing

### Test File Created
Open this URL to test: `http://your-server:1880/public/solar-widget-test.html`

This test page includes:
- Simple widget implementation
- Interactive test buttons
- Status messages
- Day cycle simulation

### Quick Test Steps

1. **Test the widget:**
   ```
   http://172.17.254.10:1880/public/solar-widget-test.html
   ```

2. **Check console:** Press F12 and look for any errors

3. **Try buttons:**
   - "Test Widget" - Updates with sample data
   - "Update Power" - Random power value
   - "Simulate Day Cycle" - 24-hour simulation
   - "Stop Simulation" - Stops the cycle

## For Node-RED Dashboard

### Method 1: Template Node (Recommended)
```html
<!-- Use the updated solar-widget-dashboard-template.html -->
<!-- It now includes proper initialization and error handling -->
```

### Method 2: Manual Implementation
If you're manually integrating, make sure to:

1. **Check element exists:**
   ```javascript
   const element = document.getElementById('yourWidgetId');
   if (element) {
       const widget = new SolarStateWidget('yourWidgetId');
   }
   ```

2. **Wait for DOM:**
   ```javascript
   document.addEventListener('DOMContentLoaded', () => {
       // Initialize widget here
   });
   ```

3. **Match IDs:**
   - HTML: `<div id="solarStateWidget">`
   - JS: `new SolarStateWidget('solarStateWidget')`
   - IDs MUST match exactly!

## Common Issues & Solutions

### Issue: Widget not appearing
**Solution:** 
- Check image path: `images/state_solor.png`
- Verify CSS file loaded: `solar-state-widget.css`
- Check container has height: `style="height: 400px"`

### Issue: Data not updating
**Solution:**
- Check `msg.payload` format
- Verify widget initialized: `console.log(window.solarStateWidget)`
- Check element IDs match (systemStatus, pvPower, etc.)

### Issue: Resize not working
**Solution:**
- Container must have explicit width/height
- Check browser supports ResizeObserver
- Check console for JavaScript errors

### Issue: Multiple widgets on same page
**Solution:**
- Use unique IDs for each widget
- Create separate instances:
  ```javascript
  const widget1 = new SolarStateWidget('widget1');
  const widget2 = new SolarStateWidget('widget2');
  ```

## Verification Checklist

Before deploying, verify:

- [ ] Container element exists in HTML
- [ ] Container has ID attribute
- [ ] ID matches constructor parameter
- [ ] CSS file is loaded
- [ ] JS file is loaded
- [ ] Container has width/height
- [ ] Image file exists (state_solor.png)
- [ ] No console errors
- [ ] Widget displays correctly
- [ ] Data updates work

## File Locations

All updated files are in: `/root/.node-red/public/`

- `solar-state-widget.js` .................. Fixed version
- `solar-widget-dashboard-template.html` ... Fixed template
- `solar-widget-test.html` ................. New test page

## Next Steps

1. ✅ Clear browser cache (Ctrl+F5)
2. ✅ Test with: `solar-widget-test.html`
3. ✅ Verify no console errors
4. ✅ Integrate into your dashboard
5. ✅ Connect to your data source

## Support

If issues persist:
1. Open browser console (F12)
2. Check for error messages
3. Verify element IDs match
4. Test with `solar-widget-test.html` first
5. Check image paths are correct

---
**Fixed:** October 24, 2025
**Error:** Container null reference
**Status:** ✅ Resolved
