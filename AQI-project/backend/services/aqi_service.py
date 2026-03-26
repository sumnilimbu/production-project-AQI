def calculate_pm25_aqi(pm25):
    """
    Calculate AQI from PM2.5 using EPA-style breakpoint ranges.
    Returns rounded AQI integer.
    """

    breakpoints = [
        (0.0, 12.0, 0, 50),
        (12.1, 35.4, 51, 100),
        (35.5, 55.4, 101, 150),
        (55.5, 150.4, 151, 200),
        (150.5, 250.4, 201, 300),
        (250.5, 350.4, 301, 400),
        (350.5, 500.4, 401, 500),
    ]

    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= pm25 <= c_high:
            aqi = ((i_high - i_low) / (c_high - c_low)) * (pm25 - c_low) + i_low
            return round(aqi)

    return 500 if pm25 > 500.4 else 0


def get_aqi_category(aqi):
    if aqi <= 50:
        return "Good"
    elif aqi <= 100:
        return "Moderate"
    elif aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    elif aqi <= 200:
        return "Unhealthy"
    elif aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def determine_fan_status(station_name, aqi, previous_fan_status="OFF"):
    """
    Fan control only applies to Industrial station.
    Uses hysteresis:
    - turn ON if AQI >= 150
    - turn OFF if AQI <= 100
    - otherwise keep previous state
    """

    if station_name.lower() != "industrial":
        return "N/A"

    if previous_fan_status == "OFF" and aqi >= 150:
        return "ON"

    if previous_fan_status == "ON" and aqi <= 100:
        return "OFF"

    return previous_fan_status