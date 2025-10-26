# TWC Weather Widget Setup Guide for Banksia Park, SA

## Overview
This guide will help you set up The Weather Company (IBM Weather) widget for your Node-RED dashboard showing weather for Banksia Park, South Australia 5091.

---

## Step 1: Get TWC API Key (IBM Weather Company)

The Weather Company is now part of IBM, so you need an IBM Cloud account:

### Option A: Free IBM Weather API Key

1. **Go to IBM Cloud:** https://cloud.ibm.com/
2. **Sign up** for a free account (no credit card required for Lite plan)
3. **Search for "Weather Company Data"** in the catalog
4. **Click** on "Weather Company Data"
5. **Select** the **"Lite" plan** (Free - 500 calls/day)
6. **Create** the service
7. **Copy your API Key** from the credentials section

### Option B: Alternative - OpenWeather (If TWC is complex)

If IBM setup is too complex, I can help you use OpenWeather API instead, which is simpler:
- Free tier: 1000 calls/day
- Signup: https://openweathermap.org/api

---

## Step 2: Import the Flow into Node-RED

I've created a flow file at: `/root/.node-red/twc-weather-flow.json`

### Import Steps:

1. Open Node-RED: `http://172.17.254.10:1880`
2. Click **Menu** (☰ top right) → **Import**
3. Click **"select a file to import"**
4. Navigate to `/root/.node-red/twc-weather-flow.json`
5. Click **Import**

---

## Step 3: Configure the TWC Weather Node

1. **Double-click** on the **"Banksia Park Weather"** node
2. **Add your API Key:**
   - Click the pencil icon next to "API Key"
   - Paste your IBM Weather API key
   - Click **Add**
3. **Verify Location Settings:**
   - Location: `Banksia Park, SA, AU` (or coordinates: `-34.85, 138.7`)
   - Units: `m` (Metric - Celsius, km/h)
   - Language: `en-US`
4. Click **Done**
5. Click **Deploy** (top right)

---

## Step 4: Test the Weather Widget

1. Click the button on the **"Manual Update"** inject node
2. Check the **Debug panel** (bug icon on right sidebar)
3. You should see weather data for Banksia Park

---

## Step 5: Connect to Your Existing UIBuilder Dashboard

The flow is already configured to send data to your UIBuilder dashboard with the topic `weather`.

Your existing `updateWeather()` function in `index.js` should already handle the data!

---

## Weather Data Structure

The flow formats data to match your existing weather widget:

```javascript
{
    temperature: 22.5,              // Current temp in °C
    apparent_temperature: 21.0,     // Feels like temp
    min_temperature: 18.0,          // Today's min
    max_temperature: 28.0,          // Today's max
    humidity: 65,                   // Humidity %
    wind_speed: 15,                 // Wind speed km/h
    wind_direction: "NW",           // Wind direction
    cloud_description: "Partly Cloudy",
    icon_code: 30,                  // Weather icon code
    uv_index: 6,
    pressure: 1013,                 // Pressure in mb
    visibility: 10,                 // Visibility in km
    timestamp: "2025-10-26T..."     // ISO timestamp
}
```

---

## Updating Frequency

The flow polls TWC every **15 minutes** to stay within free API limits (500 calls/day = ~31 per hour max).

To change the frequency:
1. Double-click the **"Poll Every 15 min"** inject node
2. Change **Repeat** interval
3. Click **Done** and **Deploy**

---

## Troubleshooting

### "API Key Invalid" Error
- Verify your IBM Weather API key is correct
- Make sure you're using the Weather Company Data service
- Check the API key has not expired

### "Location Not Found" Error
Try alternative location formats:
- `Banksia Park, SA, AU`
- `-34.85,138.7` (coordinates)
- `5091, AU` (postal code)

### No Data Appearing
1. Check Debug panel for errors
2. Verify the flow is deployed
3. Click "Manual Update" to test
4. Check browser console for errors

### Wrong Location
The TWC node should automatically find Banksia Park, SA. If not:
- Use coordinates: `-34.8522, 138.7064`
- Or try: `Adelaide, SA, AU` and adjust

---

## Alternative: Use OpenWeather Instead

If TWC setup is too complex, I can create an OpenWeather version which is simpler:

**Advantages:**
- Easier API key setup
- More generous free tier
- Better documentation

Let me know if you'd like me to create an OpenWeather version instead!

---

## Monitoring API Usage

**IBM Cloud Dashboard:**
1. Log into IBM Cloud
2. Go to **Resource List**
3. Click on your **Weather Company Data** service
4. View **Metrics** to see API calls

**Stay under 500 calls/day** with 15-minute polling:
- 4 calls/hour × 24 hours = 96 calls/day ✓

---

## Next Steps

1. Get IBM Weather API key
2. Import the flow
3. Add your API key to the TWC node
4. Test with manual trigger
5. Watch your dashboard update automatically!

---

## Need Help?

If you run into issues:
1. Check the Debug panel in Node-RED
2. Verify your API key is valid
3. Test with the manual trigger first
4. Let me know what error messages you see

Or I can help you switch to OpenWeather if TWC is too complex!
