// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: calendar-check;

// **********************************************
// *********** Begin widget config **************
// **********************************************

// Reminders config
const REMINDERS_COLOUR = new Color('#168eff');
const GROCERY_COLOUR = new Color('#ff9913');

// Football config
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
const TRAINS_SERVER_URI_DOMAIN = 'https://train-track-api.fly.dev';

// Bromley Bins config
const BROMLEY_BINS_API_URL = 'https://waste-collection.fly.dev/api/v1/bin/3642936/next_collections';
const BINS_OF_INTEREST = ['Paper & Cardboard', 'Mixed Recycling (Cans, Plastics & Glass)', 'Non-Recyclable Refuse'];
const BIN_ICONS = ['📦', '♻️', '🗑️'];

// Fonts
const DEFAULT_FONT = new Font('Menlo', 10);
const DEFAULT_FONT_BOLD = new Font('Menlo-Bold', 10);
const DEFAULT_FONT_LARGE = new Font('Menlo', 12); 
const DEFAULT_FONT_BINS_TOMORROW = new Font('Menlo-Bold', 15);

// Request timeouts (in seconds)
const DEFAULT_REQUEST_TIMEOUT_SECONDS = 10;
const BINS_REQUEST_TIMEOUT_SECONDS = 20;


// **********************************************
// *********** Begin globals ********************
// **********************************************

// Global variables
const fileManager = FileManager.local();
const locationCacheFilePath = fileManager.joinPath(fileManager.cacheDirectory(), 'mikes_life_organiser_location.txt');
let widget = new ListWidget();

// Truncate text to fit in a list widget cell, and pad with spaces to the right
function getTextFormattedForListWidget(text, length) {
    const truncatedText = text.length > length ? text.substring(0, length - 1) : text;
    return truncatedText.padEnd(length, ' ');
}

// Show a section separator (horizontal gray line)
function sectionSeparator() {
    widget.addSpacer(6);
    let hline = widget.addStack();
    hline.size = new Size(0, 1);
    hline.backgroundColor = Color.gray();
    hline.addSpacer();
    widget.addSpacer(8);
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
// If we fail after 3 attempts (which seems to happen from time to time for reasons unknown), then we return the cached location data from disk
async function getLocation(retryCount = 0) {
    try {
        let location = Location.setAccuracyToHundredMeters();
        location = await Location.current();
        setCachedLocation(location);
        return location;
    }
    catch (error) {
        console.error(`Unable to get current location data (${retryCount}): ${error}`);
        if (retryCount < 3) {
            return await getLocation(retryCount + 1);
        }
        return getCachedLocation();
    }
}

// Writes the given location data to disk
function setCachedLocation(location) {
    fileManager.writeString(locationCacheFilePath, JSON.stringify(location));

    log(`Saved location data to ${locationCacheFilePath}`);
    log(JSON.parse(fileManager.readString(locationCacheFilePath)));
}

// Returns the cached location data from disk
function getCachedLocation() {
    try {
        return JSON.parse(fileManager.readString(locationCacheFilePath));
    }
    catch (error) {
        console.error(`Unable to get cached location data from ${locationCacheFilePath}: ${error}`);
        return undefined;
    }
}

// Returns the current time in HH:MM format
function getTimeLabel() {
    const currentTime = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: 'numeric' });
    return currentTime.substring(0, 5);
}

// Returns the JSON for the given URL
async function getJson(url, timeout = DEFAULT_REQUEST_TIMEOUT_SECONDS) {
    try {
        const request = new Request(url);
        request.timeoutInterval = timeout;
        return await request.loadJSON();
    }
    catch (error) {
        console.error(`Unable to get JSON data from ${url}: ${error}`);
        return undefined;
    }
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
const header = widget.addStack();

const dateCol = header.addStack();
const dateText = header.addText(new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }));
dateText.font = DEFAULT_FONT_LARGE;
dateText.textColor = Color.white();
dateText.lineLimit = 1;
dateText.leftAlignText();
header.addStack(dateCol);

await populateRemindersContent('Reminders', REMINDERS_COLOUR);
await populateRemindersContent('Grocery', GROCERY_COLOUR);

async function populateRemindersContent(category, colour) {
    const reminders = await getReminders(category);
    const remindersCol = header.addStack();

    if (reminders.length > 0) {
        remindersCol.url = `x-apple-reminderkit://REMCDReminder/${reminders[0].identifier}`;
        addReminderInfo(remindersCol, reminders, colour);
        header.addStack(remindersCol);
    }
}

async function getReminders(category) {
    let [incompleteReminders, dueTodayReminders, scheduledReminders] = await Promise.all([Reminder.allIncomplete(), Reminder.allDueToday(), Reminder.scheduled()]);

    // Filter on overdue reminders that aren't completed
    scheduledReminders = scheduledReminders.filter(reminder => reminder.isOverdue).filter(reminder => !reminder.isCompleted);

    // Filter out any incomplete reminders thta have a due date
    incompleteReminders = incompleteReminders.filter(reminder => !reminder.dueDate);

    // Filter out any due today reminders that are already completed
    dueTodayReminders = dueTodayReminders.filter(reminder => !reminder.isCompleted);

    let reminders = scheduledReminders.concat(dueTodayReminders).concat(incompleteReminders);

    // Filter out reminders that are not in the target calendar (e.g. grocery list items vs reminders)
    reminders = reminders.filter(reminder => reminder.calendar.title === category);

    // Dedupe reminders by title
    reminders = reminders.filter((reminder, index, self) => index === self.findIndex(t => t.title === reminder.title));

    return reminders;
}

function addReminderInfo(remindersCol, reminders, colour) {
    addReminder(remindersCol, reminders[0], colour);
    if (reminders.length > 1) {
        remindersCol.addSpacer(8);
        addReminderCount(remindersCol, reminders.length, colour);
    }
}

function addReminder(remindersCol, reminder, colour) {
    remindersCol.addSpacer();
    const reminderLabel = remindersCol.addText(reminder.title);
    reminderLabel.font = DEFAULT_FONT_LARGE;
    reminderLabel.textColor = colour;
    reminderLabel.rightAlignText();
    reminderLabel.lineLimit = 1;
}

function addReminderCount(remindersCol, count, colour) {
    const countLabel = remindersCol.addText(`+${(count - 1).toString()}`);
    countLabel.font = DEFAULT_FONT_LARGE;
    countLabel.textColor = colour;
    countLabel.rightAlignText();
    countLabel.lineLimit = 1;
}



sectionSeparator();


// **********************************************
// *********** Begin football section ***********
// **********************************************

let teamLogos = {};

const [fixturesJson, resultsJson] = await Promise.all([
    getJson(`${FOOTBALL_SERVER_URI_DOMAIN}/api/v1/matches/fixtures`),
    getJson(`${FOOTBALL_SERVER_URI_DOMAIN}/api/v1/matches/results`)
]);

const matches = await getMatches();
if (matches.length > 0) {
    populateFootballContent(matches);
}

async function getMatches() {
    let matches = [];

    // Get today's results first
    if (resultsJson && resultsJson.length > 0) {
        for (const match of resultsJson) {
            // If the match date is today's date, then add it to the list
            const todaysDate = new Date().toISOString().split('T')[0];
            if (match.date === todaysDate) {
                match.friendlyDateTime = 'Today';
                matches.push(match);
            }
        }
    }

    if (fixturesJson && fixturesJson.length > 0) {
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
    }

    // Get a unique list of teams
    const teams = matches.map(match => match.homeTeam.names.displayName).concat(matches.map(match => match.awayTeam.names.displayName));
    const uniqueTeams = [...new Set(teams)];

    // Use Promises.all to set the team logos for all teams
    await Promise.all(uniqueTeams.map(team => setTeamLogos(team)));

    return matches.length > 0 ? matches.slice(0, MAX_MATCHES) : [];
}

async function setTeamLogos(teamName) {
    if (!teamLogos[teamName]) {
        const imageUrl = await getTeamLogoPath(teamName);
        if (imageUrl) {
            await setTeamLogoImage(teamName, `${FOOTBALL_SERVER_URI_DOMAIN}${imageUrl}`);
        }
        else {
            await setTeamLogoImage(teamName, `${FOOTBALL_SERVER_URI_DOMAIN}/icons/team-logos/_noLogo.png`);
        }
    }
}

async function getTeamLogoPath(teamName) {
    if (teamName.includes('/') || teamName.includes('Winner') || teamName.includes('Loser')) {
        return undefined;
    }
    else {
        const logoJson = await getJson(`${FOOTBALL_SERVER_URI_DOMAIN}/api/v1/teams/${teamName}/logo`);
        if (logoJson && logoJson.logoPath) {
            return logoJson.logoPath;
        }
    }
}

async function setTeamLogoImage(teamName, imageUrl) {
    const request = new Request(imageUrl);
    request.timeoutInterval = DEFAULT_REQUEST_TIMEOUT_SECONDS;
    const image = await request.loadImage();
    teamLogos[teamName] = image;
}

function getTeamName(teamName) {
    if (teamName.includes('/')) {
        return `${teamName.split('/')[0].slice(0, 3)}/${teamName.split('/')[1].slice(0, 3)}`;
    }
    else if (teamName.includes('Winner') || teamName.includes('Loser')) {
        return 'TBC';
    }
    else {
        return teamName;
    }
}

async function populateFootballContent(matches) {

    for (let i = 0; i < matches.length; i++) {

        const match = matches[i];
        let currentMatchDate = matches[i].friendlyDateTime;

        const row = widget.addStack();

        // Fixture date
        let matchDateLabel = undefined;
        if (i === 0 || matches[i - 1].friendlyDateTime !== currentMatchDate) {
            if (isToday(new Date(match.date))) {
                matchDateLabel = row.addText(getTextFormattedForListWidget('Today', 10));
            }
            else if (isTomorrow(new Date(match.date))) {
                matchDateLabel = row.addText(getTextFormattedForListWidget('Tomorrow', 10));
            }
            else {
                // Get the date in the format 'Mon, 29/06'
                const dateString = new Date(match.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'numeric' }).replace(',', '');
                matchDateLabel = row.addText(getTextFormattedForListWidget(dateString, 10));
            }
            setTextAttributesForDate(new Date(match.date), matchDateLabel);
            
        }
        else {
            matchDateLabel = row.addText(getTextFormattedForListWidget(' ', 10));
        }
        matchDateLabel.font = DEFAULT_FONT;
        matchDateLabel.rightAlignText();
        matchDateLabel.lineLimit = 1;
        row.addSpacer(5);

        // Match time (either in-play or kick-off time)
        let matchTime = '';
        if (match.timeLabel) {
            matchTime = match.timeLabel;
        }
        else if (match.kickOffTime) {
            matchTime = match.kickOffTime;
        }
        matchTime = getTextFormattedForListWidget(matchTime, 5);
        const matchTimeLabel = row.addText(matchTime);
        matchTimeLabel.font = DEFAULT_FONT;
        matchTimeLabel.rightAlignText();
        matchTimeLabel.lineLimit = 1;
        row.addSpacer(5);

        // Home team name
        const homeTeam = row.addText(getTextFormattedForListWidget(getTeamName(match.homeTeam.names.displayName), 8));
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
        if ((match.started || match.finished) && match.homeTeam.score >= 0) {
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
        if ((match.started || match.finished) && match.awayTeam.score >= 0) {
            log(`Away team score for ${match.awayTeam.names.displayName}: ${match.awayTeam.score}`);
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
        const awayTeam = row.addText(getTextFormattedForListWidget(getTeamName(match.awayTeam.names.displayName), 8));
        awayTeam.font = DEFAULT_FONT;
        awayTeam.leftAlignText();
        awayTeam.lineLimit = 1;
        row.addSpacer(5);

        // TV channel
        if (match.tvInfo && match.tvInfo.channelInfo && match.tvInfo.channelInfo.fullName && typeof match.tvInfo.channelInfo.fullName === 'string') {
            const channelName = match.tvInfo.channelInfo.fullName
                .replace('One', '1')
                .replace('Two', '2')
                .replace('Three', '3')
                .replace('Four', '4')
                .replace('Channel 4', 'Ch 4');
            const fixtureChannel = row.addText(getTextFormattedForListWidget(channelName, 5));
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
        row.url = 'calshow://';

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
            const dateString = event.startDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'numeric' }).replace(',', '');
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
    return await getJson(`https://api.weatherapi.com/v1/forecast.json?q=${location.latitude},${location.longitude}&days=${MAX_WEATHER_DAYS + 1}&key=${WEATHER_API_KEY}`);
}

async function populateHourlyWeatherContent(weatherRow, weatherContent, hourlyForecast) {

    for (let i = 0; i < hourlyForecast.length && weatherContent.hourly.times.length < MAX_WEATHER_HOURS; i++) {
        const forecast = hourlyForecast[i];
        const minEpoch = (Date.now() - (1000 * 60 * 60)) / 1000;

        // Iterate through current and future hours
        if (forecast.time_epoch && forecast.time_epoch >= minEpoch) {
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
    const request = new Request(imageUri);
    request.timeoutInterval = DEFAULT_REQUEST_TIMEOUT_SECONDS;
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
    let url = `${TRAINS_SERVER_URI_DOMAIN}/api/v1/departures/from/${FROM_STATION}/to/${TO_STATION}`;
    const currentTime = new Date().toISOString().split('T')[1];
    if (currentTime > REVERSE_JOURNEY_AFTER_TIME) {
        url = `${TRAINS_SERVER_URI_DOMAIN}/api/v1/departures/from/${TO_STATION}/to/${FROM_STATION}`;
    }
    return await getJson(url);
}

function populateTrainsRowContent(trainsRow, departures) {

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

async function populateBinsContent(footer) {

    const binsCol = footer.addStack();
    
    let binsLabel = '';
    const nextCollections = await getJson(BROMLEY_BINS_API_URL);
    if (nextCollections && nextCollections.nextCollectionDateDay && nextCollections.bins && nextCollections.bins.length > 0) {
        const collectionDay = getCollectionDay(nextCollections);
        binsLabel = collectionDay + ': ';
        binsLabel += nextCollections.bins.map(bin => getBinIcon(bin)).join(' ');
        const binsText = binsCol.addText(binsLabel);
        setTextAttributesForBinCollectionDate(new Date(nextCollections.nextCollectionDate), binsText);
    }
    binsCol.url = 'dev.skynolimit.bromleybins://';
    footer.addStack(binsCol);
}

function getCollectionDay(nextCollections) {
    if (isToday(new Date(nextCollections.nextCollectionDate)))
        return 'Today';
    else if (isTomorrow(new Date(nextCollections.nextCollectionDate)))
        return 'Tomorrow';
    else
        return nextCollections.nextCollectionDateDay;
}

function getBinIcon(bin) {
    if (BINS_OF_INTEREST.includes(bin)) {
        return BIN_ICONS[BINS_OF_INTEREST.indexOf(bin)];
    }
    return '';
}

// Sets font attributes the given date - white bold for tomorrow, white regular for today, gray regular for other
function setTextAttributesForBinCollectionDate(date, label) {
    if (isTomorrow(date)) {
        label.textColor = Color.white();
        label.font = DEFAULT_FONT_BINS_TOMORROW;
    }
    else if (isToday(date)) {
        label.textColor = Color.lightGray();
        label.font = DEFAULT_FONT;
    }
    else {
        label.textColor = Color.gray();
        label.font = DEFAULT_FONT;
    }
}



// **********************************************
// *********** Begin footer section *************
// **********************************************`
const footer = widget.addStack();

await populateBinsContent(footer);

const lastUpdatedCol = footer.addStack();
lastUpdatedCol.addSpacer();
const lastUpdatedText = lastUpdatedCol.addText(`Updated: ${new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: 'numeric' })}`); 
// lastUpdatedCol.addSpacer();
lastUpdatedText.font = DEFAULT_FONT_LARGE;
lastUpdatedText.textColor = Color.white();
lastUpdatedText.lineLimit = 1;
lastUpdatedText.rightAlignText();
footer.addStack(lastUpdatedCol);

widget.addStack(footer);

Script.setWidget(widget);
widget.presentLarge();
Script.complete();