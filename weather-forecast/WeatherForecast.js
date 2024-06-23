// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: sun;



// **********************************************
// *********** Begin widget config **************
// **********************************************

// REQUIRED: Please obtain a free API key from https://www.weatherapi.com and enter it here
const WEATHER_API_KEY = 'YOUR_API_KEY_HERE';

// The maximum number of hours / days to show in the widget
const MAX_WEATHER_HOURS = 4;
const MAX_WEATHER_DAYS = 4;



// **********************************************
// *********** Begin globals ********************
// **********************************************

// Global variables
let widget = new ListWidget();
let teamLogos = {};

// Truncate text to fit in a list widget cell, and pad with spaces to the right
function getTextFormattedForListWidget(text, length) {
    const truncatedText = text.length > length ? text.substring(0, length - 1) : text;
    return truncatedText.padEnd(length, ' ');
}

// Show a section separator (horizontal gray line)
function sectionSeparator() {
    widget.addSpacer(10);
    let hline = widget.addStack();
    hline.size = new Size(0, 1);
    hline.backgroundColor = Color.gray();
    hline.addSpacer();
    widget.addSpacer(10);
}

// Returns true if the given date is today
function isToday(date) {
    return date.toLocaleDateString() === new Date().toLocaleDateString();
}

// Returns true if the given date is tomorrow
function isTomorrow(date) {
    return date.toLocaleDateString() === new Date(new Date().getTime() + (1000 * 60 * 60 * 24)).toLocaleDateString();
}

// Sets font attributes the given date - white bold for today, white regular for tomorrow, gray regular for other
function setTextAttributesForDate(date, label) {
    if (isToday(date)) {
        label.textColor = Color.white();
        label.font = DEFAULT_FONT_BOLD;
    }
    else if (isTomorrow(date)) {
        label.textColor = Color.lightGray();
        label.font = DEFAULT_FONT;
    }
    else {
        label.textColor = Color.gray();
        label.font = DEFAULT_FONT;
    }
}

// Returns true if the given calendar event should be shown, i.e. doesn't include any of the words in DO_NOT_SHOW_EVENTS
function shouldShowEvent(event) {
    for (const word of DO_NOT_SHOW_EVENTS) {
        if (event.title.toLowerCase().includes(word.toLowerCase())) {
            return false;
        }
    }
    return true;
}


// **********************************************
// *********** Begin weather section ************
// **********************************************

async function populateWeatherContent() {

    log('Getting location data');
    const location = await getLocation();
    log('Got location data');
    const forecastData = await getForecastData(location);

    if (
        forecastData &&
        forecastData.forecast &&
        forecastData.forecast.forecastday &&
        forecastData.forecast.forecastday.length > 0 &&
        forecastData.forecast.forecastday[0].hour &&
        forecastData.forecast.forecastday[0].hour.length > 0
    ) {
        let weatherContent = {
            hourly: {
                times: [],
                icons: {
                    urls: [],
                    images: []
                },
                temps: [],
                chances_of_rain: [],
                precip_mm: []
            },
            daily: {
                times: [],
                icons: {
                    urls: [],
                    images: []
                },
                temps: [],
                chances_of_rain: [],
                precip_mm: []
            }
        }
        const weatherRow = widget.addStack();
        weatherRow.url = 'weather://';
        await populateHourlyWeatherContent(weatherRow, weatherContent, forecastData.forecast.forecastday[0].hour);
        weatherSeparator(weatherRow);
        await populateDailyWeatherContent(weatherRow, weatherContent, forecastData.forecast.forecastday);
        widget.addStack(weatherRow);
    }

}

async function getLocation() {
    log('Getting location data');
    let location = Location.setAccuracyToHundredMeters();
    location = await Location.current();
    log('Location: ' + JSON.stringify(location));
    const geocode = await Location.reverseGeocode(location.latitude, location.longitude, Device.locale());
    location.locality = geocode[0].locality;
    return location;
}

async function getForecastData(location) {
    const url = `https://api.weatherapi.com/v1/forecast.json?q=${location.latitude},${location.longitude}&days=${MAX_WEATHER_DAYS + 1}&key=${WEATHER_API_KEY}`;
    log('Getting forecast: ' + url);
    const weatherRequest = new Request(url);
    return await weatherRequest.loadJSON();
}

async function populateHourlyWeatherContent(weatherRow, weatherContent, hourlyForecast) {
    log('Populating hourly weather content: ' + hourlyForecast.length);

    for (let i = 0; i < hourlyForecast.length && weatherContent.hourly.times.length < MAX_WEATHER_HOURS; i++) {
        const forecast = hourlyForecast[i];
        const minEpoch = (Date.now() - (1000 * 60 * 60 * 5)) / 1000;

        // Iterate through current and future hours
        if (forecast.time_epoch && forecast.time_epoch >= minEpoch) {
            log(' -- Adding hour: ' + forecast.time);
            weatherContent.hourly.times.push(forecast.time.split(' ')[1]);          // Get the time in 24-hour format
            weatherContent.hourly.icons.urls.push(forecast.condition.icon);         // Get the forecast icon  
            weatherContent.hourly.temps.push(forecast.temp_c);                      // Get the temperature
            weatherContent.hourly.chances_of_rain.push(forecast.chance_of_rain);    // Get the chance of rain
            weatherContent.hourly.precip_mm.push(forecast.precip_mm);               // Get the precipitation in mm
        }
    }

    weatherContent.hourly.icons.images = await Promise.all(weatherContent.hourly.icons.urls.map((url) => getForecastIcon(url)));
    await populateWeatherContentCols(weatherRow, weatherContent.hourly);
}

function weatherSeparator(weatherRow) {
    const col = weatherRow.addStack();
    col.layoutVertically();
    for (let i = 0; i < 3; i++) {
        const row = col.addStack();
        row.backgroundColor = Color.darkGray();
        row.size = new Size(1, 20);
        row.addSpacer();

    }
    weatherRow.addStack(col);
}

async function populateDailyWeatherContent(weatherRow, weatherContent, dailyForecast) {
    log('Populating daily weather content: ' + dailyForecast.length);

    for (let i = 0; i < dailyForecast.length && weatherContent.daily.times.length < MAX_WEATHER_DAYS; i++) {
        const forecast = dailyForecast[i];
        const minEpoch = (Date.now() - (1000 * 60 * 60)) / 1000;


        // Get current date in format YYYY-MM-DD
        const currentDate = new Date().toISOString().split('T')[0];

        // Iterate through future days
        if (forecast.date && forecast.date > currentDate) {
            log(' -- Adding date: ' + forecast.date);
            const dayOfWeek = new Date(forecast.date).toLocaleDateString('en-US', { weekday: 'short' });
            weatherContent.daily.times.push(dayOfWeek);                            // Get the time in 24-hour format  
            weatherContent.daily.icons.urls.push(forecast.day.condition.icon);         // Get the forecast icon  
            weatherContent.daily.temps.push(forecast.day.avgtemp_c);                      // Get the temperature
            weatherContent.daily.chances_of_rain.push(forecast.day.daily_chance_of_rain);    // Get the chance of rain
            weatherContent.daily.precip_mm.push(forecast.day.totalprecip_mm);               // Get the precipitation in mm
        }
    }

    weatherContent.daily.icons.images = await Promise.all(weatherContent.daily.icons.urls.map((url) => getForecastIcon(url)));
    await populateWeatherContentCols(weatherRow, weatherContent.daily);
}

async function populateWeatherContentCols(weatherRow, weatherContent) {
    for (let i = 0; i < weatherContent.times.length; i++) {
        const col = weatherRow.addStack();
        col.layoutVertically();

        const colTimes = col.addStack();
        const colIcons = col.addStack();
        const colTemps = col.addStack();
        const colRainDetails = col.addStack();

        addWeatherDayOrTime(colTimes, weatherContent.times[i]);
        addWeatherIcon(colIcons, weatherContent.icons.images[i]);
        addWeatherTemp(colTemps, weatherContent.temps[i]);
        addWeatherRain(colRainDetails, weatherContent.chances_of_rain[i], weatherContent.precip_mm[i]);
    }
}

// Get the given weather forecast icon
async function getForecastIcon(iconUriSuffix) {
    const imageUri = `https:${iconUriSuffix}`;
    log('Getting icon: ' + imageUri);
    const request = new Request(imageUri);
    const image = await request.loadImage();
    return image;
}

function addWeatherDayOrTime(col, time) {
    col.addSpacer();
    const timeLabel = col.addText(time);
    col.addSpacer();
    timeLabel.font = new Font('Menlo', 8);
    timeLabel.textColor = Color.white();
    timeLabel.centerAlignText();
    timeLabel.lineLimit = 1;
}

function addWeatherIcon(col, icon) {
    col.addSpacer();
    const iconImage = col.addImage(icon);
    col.addSpacer();
    iconImage.imageSize = new Size(25, 25);
}

function addWeatherTemp(col, temp) {
    log('Adding temp: ' + temp);
    const tempValueInt = parseInt(temp, 10);
    col.addSpacer();
    const tempLabel = col.addText(tempValueInt.toString());
    col.addSpacer();
    tempLabel.font = new Font('Menlo-Bold', 10);

    if (temp <= 0) tempLabel.textColor = new Color('#5554d9');
    else if (temp < 8) tempLabel.textColor = '#2c9aff';
    else if (temp < 12) tempLabel.textColor = new Color('#61d2d9');
    else if (temp < 16) tempLabel.textColor = new Color('#93d197');
    else if (temp < 20) tempLabel.textColor = new Color('#c0ce57');
    else if (temp < 25) tempLabel.textColor = new Color('#ffc800');
    else if (temp < 30) tempLabel.textColor = new Color('#ff9913');
    else tempLabel.textColor = new Color('#fe4c29');

    tempLabel.centerAlignText();
}

function addWeatherRain(col, chance, precip_mm) {
    col.addSpacer();
    const rainLabel = col.addText(precip_mm.toString());
    col.addSpacer();
    rainLabel.font = new Font('Menlo-Bold', 10);

    if (precip_mm >= 0) rainLabel.textColor = new Color('#5ac6f7');
    else rainLabel.textColor = Color.gray();

    rainLabel.centerAlignText();
    rainLabel.lineLimit = 1;
}

await populateWeatherContent();


// Populate widget
Script.setWidget(widget)
widget.presentSmall()
Script.complete()