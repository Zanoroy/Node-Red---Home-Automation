-- Google Weather API Database Schema

-- Current weather conditions table
CREATE TABLE IF NOT EXISTS weather_current (
  timestamp DATETIME PRIMARY KEY,
  temperature REAL,
  feels_like REAL,
  humidity INTEGER,
  pressure REAL,
  wind_speed REAL,
  wind_direction INTEGER,
  wind_cardinal TEXT,
  condition TEXT,
  condition_type TEXT,
  uv_index INTEGER,
  visibility REAL,
  dew_point REAL,
  cloud_cover INTEGER,
  precipitation_prob INTEGER,
  is_daytime INTEGER
);

-- 10-day forecast table
CREATE TABLE IF NOT EXISTS weather_forecast (
  timestamp DATETIME,
  forecast_date DATE,
  day_number INTEGER,
  min_temp REAL,
  max_temp REAL,
  min_feels_like REAL,
  max_feels_like REAL,
  day_condition TEXT,
  day_condition_type TEXT,
  night_condition TEXT,
  night_condition_type TEXT,
  precipitation_prob_day INTEGER,
  precipitation_prob_night INTEGER,
  precipitation_amount_day REAL,
  precipitation_amount_night REAL,
  wind_speed_day REAL,
  wind_speed_night REAL,
  wind_direction_day INTEGER,
  wind_direction_night INTEGER,
  humidity_day INTEGER,
  humidity_night INTEGER,
  uv_index INTEGER,
  sunrise_time TEXT,
  sunset_time TEXT,
  moon_phase TEXT,
  PRIMARY KEY (timestamp, forecast_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_current_timestamp ON weather_current(timestamp);
CREATE INDEX IF NOT EXISTS idx_forecast_date ON weather_forecast(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecast_timestamp ON weather_forecast(timestamp);