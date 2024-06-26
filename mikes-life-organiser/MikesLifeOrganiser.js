// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: futbol;

// **********************************************
// *********** Begin widget config **************
// **********************************************

// Football config
const DEVICE_ID = 'DEVICE_ID_SECRET'
const MAX_MATCHES = 5;
const FOOTBALL_SERVER_URI_DOMAIN = 'https://football-scores-api.fly.dev';

// Calendar config
const MAX_EVENTS = 5;
const CALENDARS = ['Mike Wagstaff', 'Parties', 'School'];
const CALENDAR_TAGS = ['', '🎉', ''];
const DO_NOT_SHOW_EVENTS = ['laundry'];

// Weather config
const WEATHER_API_KEY = 'WEATHER_API_KEY_SECRET';
const MAX_WEATHER_HOURS = 4;
const MAX_WEATHER_DAYS = 4;

// Trains config
// Use station CRS codes, which can be found here: http://www.railwaycodes.org.uk/stations/station0.shtm
const FROM_STATION = 'KTH';
const TO_STATION = 'VIC';
const REVERSE_JOURNEY_AFTER_TIME = '12:00';
const MAX_TRAINS = 4;

// Bromley Bins config
const BROMLEY_BINS_API_URL = 'http://mikes-macbook-air.local:3004/api/v1/bin/3642936/bins_for_tomorrow';
const BINS_OF_INTEREST = ['Paper & Cardboard', 'Mixed Recycling (Cans, Plastics & Glass)', 'Non-Recyclable Refuse'];
const BIN_ICONS = ['📦', '♻️', '🗑️'];

// General config
const DEFAULT_FONT = new Font('Menlo', 10);
const DEFAULT_FONT_LARGE = new Font('Menlo', 12); 
const DEFAULT_FONT_BOLD = new Font('Menlo-Bold', 10);


// **********************************************
// *********** Begin globals ********************
// **********************************************

// Global variables
let widget = new ListWidget();

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

// Show a date separator (horizontal dark gray line)
function dateSeparator() {
    widget.addSpacer(5);
    let hline = widget.addStack();
    hline.size = new Size(0, 1);
    hline.backgroundColor = Color.darkGray();
    hline.addSpacer();
    widget.addSpacer(5);
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

// Returns the user's current location
// Note we set accuracy to 100m as the default (most precise fix) can take up to 10 seconds to return
async function getLocation(retryCount = 0) {
    try {
        log('Getting location data');
        let location = Location.setAccuracyToHundredMeters();
        location = await Location.current();
        log('Location: ' + JSON.stringify(location));
        return location;
    }
    catch (error) {
        log(`Unable to get location data (${retryCount}): ${error}`);
        if (retryCount < 5) {
            return await getLocation(retryCount + 1);
        }
        return undefined;
    }
}

// Returns the current time in HH:MM format
function getTimeLabel() {
    const currentTime = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: 'numeric' });
    return currentTime.substring(0, 5);
}


// **********************************************
// *********** Begin widget setup ***************
// **********************************************

// Optimistically aim for a 30 second refresh (in reality, iOS will only refresh every 10-15 minutes)
let nextRefresh = Date.now() + (1000 * 30);
widget.refreshAfterDate = new Date(nextRefresh);



// **********************************************
// *********** Begin header section *************
// **********************************************`
const headerText = widget.addText(new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' }));
headerText.font = DEFAULT_FONT_LARGE;
headerText.textColor = Color.white();
headerText.lineLimit = 1;
headerText.centerAlignText();



sectionSeparator();


// **********************************************
// *********** Begin football section ***********
// **********************************************

let teamLogos = {};

const fixturesRequest = new Request(`${FOOTBALL_SERVER_URI_DOMAIN}/api/v1/user/${DEVICE_ID}/matches/fixtures`);
const resultsRequest = new Request(`${FOOTBALL_SERVER_URI_DOMAIN}/api/v1/user/${DEVICE_ID}/matches/results`);

const [fixturesJson, resultsJson] = await Promise.all([fixturesRequest.loadJSON(), resultsRequest.loadJSON()]);

const matches = await getMatches();
if (matches.length > 0) {
    populateFootballContent(matches);
}

async function getMatches() {
    let matches = [];

    // Get today's results first
    for (const match of resultsJson) {
        // If the match date is today's date, then add it to the list
        const todaysDate = new Date().toISOString().split('T')[0];
        if (match.date === todaysDate) {
            match.friendlyDateTime = 'Today';
            matches.push(match);
        }
    }

    for (const match of fixturesJson) {
        // Check if the matches array already contains a match with the same ID, i.e. we already have a result
        // If there's already a result, don't add the corresponding fixture
        const matchIndex = matches.findIndex(m => m.id === match.id);
        if (matchIndex === -1 && match.friendlyDateTime) {
            matches.push(match);
        }

        // If we've reached the maximum number of matches, then stop
        if (matches.length >= MAX_MATCHES) {
            break;
        }
    }

    // Get a unique list of teams
    const teams = matches.map(match => match.homeTeam.names.displayName).concat(matches.map(match => match.awayTeam.names.displayName));
    const uniqueTeams = [...new Set(teams)];

    // Use Promises.all to set the team logos for all teams
    await Promise.all(uniqueTeams.map(team => setTeamLogos(team)));

    return matches.slice(0, MAX_MATCHES);
}

async function setTeamLogos(teamName) {
    if (!teamLogos[teamName]) {
        const imageUrl = await getTeamLogoPath(teamName);
        await setTeamLogoImage(teamName, `${FOOTBALL_SERVER_URI_DOMAIN}${imageUrl}`);
    }
}

async function getTeamLogoPath(teamName) {
    const request = new Request(`${FOOTBALL_SERVER_URI_DOMAIN}/api/v1/teams/${teamName}/logo`);
    const logoJson = await request.loadJSON();
    return logoJson.logoPath;
}

async function setTeamLogoImage(teamName, imageUrl) {
    const request = new Request(imageUrl);
    const image = await request.loadImage();
    teamLogos[teamName] = image;
}


async function populateFootballContent(matches) {

    for (let i = 0; i < matches.length; i++) {

        const match = matches[i];
        let currentMatchDate = matches[i].friendlyDateTime;

        const row = widget.addStack();

        // Fixture or match time
        let matchTime = '';
        if (match.timeLabel) {
            matchTime = match.timeLabel;
        }
        else if (match.kickOffTime) {
            matchTime = match.kickOffTime;
        }
        if (i === 0 || matches[i - 1].friendlyDateTime !== currentMatchDate) {
            matchTime = getTextFormattedForListWidget(currentMatchDate + ' ' + matchTime, 17);
        }
        else {
            matchTime = getTextFormattedForListWidget(matchTime, 17);
        }
        const matchTimeLabel = row.addText(matchTime);
        setTextAttributesForDate(new Date(match.date), matchTimeLabel);
        matchTimeLabel.rightAlignText();
        matchTimeLabel.lineLimit = 1;
        row.addSpacer(5);

        // Home team name
        const homeTeam = row.addText(getTextFormattedForListWidget(match.homeTeam.names.displayName, 7));
        homeTeam.font = DEFAULT_FONT;
        homeTeam.rightAlignText();
        homeTeam.lineLimit = 1;
        row.addSpacer(10);

        // Home team logo
        const homeTeamLogo = row.addImage(teamLogos[match.homeTeam.names.displayName]);
        homeTeamLogo.imageSize = new Size(15, 15);
        row.addSpacer(2);

        // Home team score
        let homeTeamScore = getTextFormattedForListWidget('', 2);
        if (match.homeTeam.score) {
            homeTeamScore = getTextFormattedForListWidget(match.homeTeam.score.toString(), 2);
        }
        const homeTeamScoreLabel = row.addText(homeTeamScore);
        homeTeamScoreLabel.font = DEFAULT_FONT;
        homeTeamScoreLabel.rightAlignText();
        homeTeamScoreLabel.lineLimit = 1;

        // Score line separator
        const scoreSeparator = row.addText('- ');
        scoreSeparator.font = DEFAULT_FONT;
        scoreSeparator.centerAlignText();
        scoreSeparator.lineLimit = 1;

        // Away team score
        let awayTeamScore = getTextFormattedForListWidget('', 2);
        if (match.awayTeam.score) {
            awayTeamScore = getTextFormattedForListWidget(match.awayTeam.score.toString(), 2);
        }
        const awayTeamScoreLabel = row.addText(awayTeamScore);
        awayTeamScoreLabel.font = DEFAULT_FONT;
        awayTeamScoreLabel.leftAlignText();
        awayTeamScoreLabel.lineLimit = 1;
        row.addSpacer(2);

        // Away team logo
        const awayTeamLogo = row.addImage(teamLogos[match.awayTeam.names.displayName]);
        awayTeamLogo.imageSize = new Size(15, 15);
        row.addSpacer(10);

        // Away team name
        const awayTeam = row.addText(getTextFormattedForListWidget(match.awayTeam.names.displayName, 7));
        awayTeam.font = DEFAULT_FONT;
        awayTeam.leftAlignText();
        awayTeam.lineLimit = 1;
        row.addSpacer(5);

        // TV channel
        if (match.tvInfo && match.tvInfo.channelInfo && match.tvInfo.channelInfo.fullName && typeof match.tvInfo.channelInfo.fullName === 'string') {
            const fixtureChannel = row.addText(getTextFormattedForListWidget(match.tvInfo.channelInfo.fullName, 7));
            fixtureChannel.font = DEFAULT_FONT;
            fixtureChannel.textColor = Color.gray();
            fixtureChannel.leftAlignText();
            fixtureChannel.lineLimit = 1;
        }

        // Add a date separator line if necessary 
        if (i < matches.length - 1 && matches[i + 1].friendlyDateTime !== currentMatchDate) {
            dateSeparator();
        }

        row.url = 'dev.skynolimit.topscores://';
        widget.addStack(row);
    }

}



sectionSeparator();



// **********************************************
// *********** Begin calender section ***********
// **********************************************

// Set start date to today, end date to 30 days from today
const startDate = new Date();
const endDate = new Date(startDate.getTime() + (1000 * 60 * 60 * 24 * 30));

const eventsArray = await CalendarEvent.between(startDate, endDate);
let eventsFound = 0;

for (let eventIndex = 0; eventIndex < eventsArray.length && eventsFound < MAX_EVENTS; eventIndex++) {

    const event = eventsArray[eventIndex];

    // Only show events from selected calendars, and if the event title doesn't include any of the words in DO_NOT_SHOW_EVENTS

    if (CALENDARS.includes(event.calendar.title) && shouldShowEvent(event)) {

        const event = eventsArray[eventIndex];
        const row = widget.addStack();
        row.url = `calshow:\${event.startDate}`;
        log('Row URL: ' + row.url);

        // If the event start date is today's date, then add it to the list
        let eventStartDateLabel = undefined;
        if (isToday(event.startDate)) {
            eventStartDateLabel = row.addText(getTextFormattedForListWidget('Today', 10));
        }
        else if (isTomorrow(event.startDate)) {
            eventStartDateLabel = row.addText(getTextFormattedForListWidget('Tomorrow', 10));
        }
        else {
            // Get the date in the format 'Mon, 29/06'
            const dateString = event.startDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'numeric' });
            eventStartDateLabel = row.addText(getTextFormattedForListWidget(dateString, 10));
            eventStartDateLabel.font = DEFAULT_FONT;
        }
        setTextAttributesForDate(event.startDate, eventStartDateLabel);
        eventStartDateLabel.rightAlignText();
        eventStartDateLabel.lineLimit = 1;
        row.addSpacer(5);

        // Event time
        let eventTimeLabel = undefined;
        if (event.isAllDay) {
            eventTimeLabel = row.addText(getTextFormattedForListWidget('', 6));
        }
        else {
            eventTimeLabel = row.addText(getTextFormattedForListWidget(event.startDate.toLocaleTimeString(), 6));
        }
        setTextAttributesForDate(event.startDate, eventTimeLabel);
        eventTimeLabel.leftAlignText();
        eventTimeLabel.lineLimit = 1;
        row.addSpacer(5);

        // Event title
        const eventTitleLabel = row.addText(getTextFormattedForListWidget(event.title, 35));
        setTextAttributesForDate(event.startDate, eventTitleLabel);
        eventTitleLabel.leftAlignText();
        eventTitleLabel.lineLimit = 1;
        eventTitleLabel.font = DEFAULT_FONT_LARGE;
        row.addSpacer(10);


        // Event tag
        const eventTagLabel = row.addText(getTextFormattedForListWidget(CALENDAR_TAGS[CALENDARS.indexOf(event.calendar.title)], 2));
        eventTagLabel.rightAlignText();
        eventTagLabel.font = DEFAULT_FONT;
        eventTagLabel.lineLimit = 1;

        widget.addStack(row);

        eventsFound++;

    }

}



// Add separator
sectionSeparator();



// **********************************************
// *********** Begin weather section ************
// **********************************************

async function populateWeatherContent() {
    const location = await getLocation();

    if (location) {
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
        const minEpoch = (Date.now() - (1000 * 60 * 60)) / 1000; // TODO: Remove the 5!

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

        // Get current date in format YYYY-MM-DD
        const currentDate = new Date().toISOString().split('T')[0];

        // Iterate through future days
        if (forecast.date && forecast.date > currentDate) {
            const dayOfWeek = new Date(forecast.date).toLocaleDateString('en-US', { weekday: 'short' });
            weatherContent.daily.times.push(dayOfWeek);                                     // Get the time in 24-hour format  
            weatherContent.daily.icons.urls.push(forecast.day.condition.icon);              // Get the forecast icon  
            weatherContent.daily.temps.push(forecast.day.maxtemp_c);                        // Get the temperature
            weatherContent.daily.chances_of_rain.push(forecast.day.daily_chance_of_rain);   // Get the chance of rain
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
    tempLabel.lineLimit = 1;

    tempLabel.centerAlignText();
}

function addWeatherRain(col, chance, precip_mm) {
    col.addSpacer();
    const rainLabel = col.addText(precip_mm.toString());
    col.addSpacer();
    rainLabel.font = new Font('Menlo-Bold', 10);

    if (precip_mm > 0) rainLabel.textColor = new Color('#5ac6f7');
    else rainLabel.textColor = Color.gray();

    rainLabel.centerAlignText();
    rainLabel.lineLimit = 1;
}

await populateWeatherContent();



// Add separator
sectionSeparator();



// **********************************************
// *********** Begin trains section *************
// **********************************************

async function populateTrainsContent() {

    const trainsData = await getTrainsData();

    if (trainsData && trainsData.departures) {
        const trainsRow = widget.addStack();
        trainsRow.url = 'traintrack://';
        await populateTrainsRowContent(trainsRow, trainsData.departures);
        widget.addStack(trainsRow);
    } else {
        const trainsRow = widget.addStack();
        trainsRow.url = 'traintrack://';
        trainsRow.addSpacer();
        const noTrainsText = trainsRow.addText('No trains found... 🥲');
        noTrainsText.font = DEFAULT_FONT_LARGE;
        noTrainsText.textColor = Color.gray();
        noTrainsText.lineLimit = 1;
        trainsRow.addSpacer();
        noTrainsText.centerAlignText(); 
        widget.addStack(trainsRow); 
    }

}

async function getTrainsData() {

    // If the current time is after the reverse journey time, then reverse the journey
    let url = `https://train-track-api.fly.dev/api/v1/departures/from/${FROM_STATION}/to/${TO_STATION}`;
    const currentTime = new Date().toISOString().split('T')[1];
    if (currentTime > REVERSE_JOURNEY_AFTER_TIME) {
        url = `https://train-track-api.fly.dev/api/v1/departures/from/${TO_STATION}/to/${FROM_STATION}`;
    }

    const request = new Request(url);
    return await request.loadJSON();
}

function populateTrainsRowContent(trainsRow, departures) {
    log('Populating trains content: ' + departures.length);

    const stationNameLabel = trainsRow.addText(departures[0].locationDetail.crs);
    stationNameLabel.font = new Font('Menlo-Bold', 12);
    stationNameLabel.textColor = Color.lightGray();
    stationNameLabel.centerAlignText();
    stationNameLabel.lineLimit = 1;
    trainsRow.addSpacer();
    trainsRow.url = 'traintrack://';

    for (let i = 0; i < departures.length && i < MAX_TRAINS; i++) {
        const departure = departures[i];
        addDeparture(trainsRow, departure);
    }
}

function addDeparture(trainsRow, departure) {
    log('Adding departure: ' + departure);
    const departureRow = trainsRow.addStack();
    departureRow.url = 'traintrack://';
    const delay = getDelay(departure.locationDetail.gbttBookedDeparture, departure.locationDetail.realtimeDeparture);
    addDepartureTime(departureRow, departure.locationDetail.realtimeDeparture, delay, departure.locationDetail.cancelReasonCode);
    addDeparturePlatform(departureRow, departure.locationDetail.platform, departure.locationDetail.cancelReasonCode);
    departureRow.addSpacer();
}

// Returns any delay in minutes between the booked and realtime departure times which are in the format HHMM
function getDelay(bookedDepartureTime, realtimeDepartureTime) {
    // Handle edge case for departures scheduled to close to midnight but are delayed until the next day
    if (bookedDepartureTime.slice(0, 2) == '23' && realtimeDepartureTime.slice(0, 2) == '00') {
        realtimeDepartureTime += 2400;
    }
    const delay = realtimeDepartureTime - bookedDepartureTime;
    return delay;
}

function addDepartureTime(departureRow, departureTime, delay, cancelReasonCode) {

    const col = departureRow.addStack();
    col.addSpacer(3);
    // Add a ':' time separator, e.g. change to '12:00' from '1200'
    const departureTimeLabel = col.addText(departureTime.replace(/(\d{2})(\d{2})/, '$1:$2'));
    col.addSpacer(3);
    departureTimeLabel.font = new Font('Menlo-Bold', 12);
    departureTimeLabel.centerAlignText();
    departureTimeLabel.lineLimit = 1;

    // Set colours based on any delay/cancellation
    const departureColours = getDepartureColors(delay, cancelReasonCode);
    col.backgroundColor = departureColours.backgroundColor;

    // Apply a strike-through effect if the train is cancelled 
    if (cancelReasonCode) {
        col.backgroundGradient = getStrikeThrough()
    }

    departureTimeLabel.textColor = departureColours.foregroundColor;

    departureRow.addSpacer(10);
}

// Returns a strike-through "gradient" that can be applied to cancelled departures
function getStrikeThrough() {
    let borderTopBG = new LinearGradient()
    let c1 = Color.white();
    let transparent = new Color("#000000", 0)

    let strikeHeight = 5

    borderTopBG.colors = [
        transparent,
        transparent,
        c1,
        c1,
        transparent,
        transparent
    ]

    borderTopBG.locations = [
        0,
        0.52 - (strikeHeight / 200),
        0.52 - (strikeHeight / 200),
        0.52 + (strikeHeight / 200),
        0.52 + (strikeHeight / 200),
        1
    ]

    return borderTopBG;
}

function getDepartureColors(delay, cancelReasonCode) {

    if (cancelReasonCode) {
        return {
            backgroundColor: new Color('#fe4c29'),
            foregroundColor: Color.white()
        }
    }

    let backgroundColor = new Color('#57f470');
    let foregroundColor = Color.black();

    if (delay > 6) {
        backgroundColor = new Color('#fe4c29');
        foregroundColor = Color.white();
    }
    else if (delay > 4) {
        backgroundColor = new Color('#ff9913');
    }
    else if (delay > 2) {
        backgroundColor = new Color('#ffc800');
    }
    else if (delay > 0) {
        backgroundColor = new Color('#61d2d9');
    }

    return {
        backgroundColor: backgroundColor,
        foregroundColor: foregroundColor
    }
}

// Displays platform number by default, or an "X" if the train is cancelled
function addDeparturePlatform(departureRow, platform, cancelReasonCode) {
    if (cancelReasonCode) {
        platform = 'X';
    }
    const platformLabel = departureRow.addText(platform);
    platformLabel.font = new Font('Menlo-Bold', 12);
    platformLabel.textColor = Color.white();
    platformLabel.centerAlignText();
    platformLabel.lineLimit = 1;
    departureRow.addSpacer(5);
}

await populateTrainsContent();



sectionSeparator();



// **********************************************
// *********** Begin bins section ***************
// **********************************************

async function getBinIconsLabel() {
    const binsRequest = new Request(BROMLEY_BINS_API_URL);
    const binsForTomorrow = await binsRequest.loadJSON();

    let binContent = '';
    if (binsForTomorrow && binsForTomorrow.length > 0) {
        let binIndex = 0;
        for (const bin of binsForTomorrow) {
            log(bin);
            if (BINS_OF_INTEREST.includes(bin)) {
                log('Adding bin of interest: ' + bin);
                binContent += BIN_ICONS[binIndex];
                binIndex++;
            }
        }
    }

    return binContent;
}



// **********************************************
// *********** Begin footer section *************
// **********************************************`
const footer = widget.addStack();
footer.addSpacer();
const footerText = footer.addText(`Updated: ${new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: 'numeric' })}`); 
footer.addSpacer();
footerText.font = DEFAULT_FONT_LARGE;
footerText.textColor = Color.white();
footerText.lineLimit = 1;
footerText.centerAlignText();

const binIconsLabel = await getBinIconsLabel();
if (binIconsLabel.length > 0) {
    const binsContent = footer.addStack();
    const binText = binsContent.addText(binIconsLabel);
    binText.font = new Font('Menlo-Bold', 14);
    binsContent.url = 'dev.skynolimit.bromleybins://';
}

Script.setWidget(widget);
widget.presentLarge();
Script.complete();