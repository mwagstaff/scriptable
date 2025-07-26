// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: train;

// Supporting Scriptable widget for TrainTrack UK:
// https://apps.apple.com/gb/app/traintrack-uk/id6504205950

// **********************************************
// *********** Begin widget config **************
// **********************************************

// Define the from and to stations
// Use station CRS codes, which can be found here: http://www.railwaycodes.org.uk/stations/station0.shtm
const FROM_STATION = 'ECR';
const TO_STATION = 'LBG';

// The maximum number of trains to show in the widget
const MAX_TRAINS = 3;

// Fonts - adjust size as needed
const DEFAULT_FONT = new Font('Menlo', 15);

// Request timeouts (in seconds)
const DEFAULT_REQUEST_TIMEOUT_SECONDS = 10;



// ********************************************************************************************
// Widget code starts here - please don't touch unless you know what you're doing!
// ********************************************************************************************

// **********************************************
// *********** Begin globals ********************
// **********************************************

// Global variables
let widget = new ListWidget();

// Show a section separator (horizontal gray line)
function sectionSeparator() {
    widget.addSpacer(10);
    let hline = widget.addStack();
    hline.size = new Size(0, 1);
    hline.backgroundColor = Color.gray();
    hline.addSpacer();
    widget.addSpacer(10);
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
// *********** Begin trains section *************
// **********************************************

async function populateTrainsContent() {

    const trainsData = await getTrainsData();

    let trainsDataIndex = 0;

    if (trainsData && trainsData.length > 0) {
        for (const data of trainsData) {
            if (data.departures) {
                const trainsRow = widget.addStack();
                trainsRow.url = 'traintrack://';
                
                // Set the departure station name to be FROM_STATION if this is the first trainsData item
                const departureStationName = trainsDataIndex === 0 ? FROM_STATION : TO_STATION;

                await populateTrainsRowContent(departureStationName, trainsRow, data.departures);
                widget.addStack(trainsRow);
                sectionSeparator();
            }
            trainsDataIndex++;
        }
    }

}

async function getTrainsData() {

    // If the current time is after the reverse journey time, then reverse the journey
    let urls = [
        `https://train-track-api.fly.dev/api/v1/departures/from/${FROM_STATION}/to/${TO_STATION}`,
        `https://train-track-api.fly.dev/api/v1/departures/from/${TO_STATION}/to/${FROM_STATION}`
    ];

    return await Promise.all(urls.map(url => getJson(url)));
}

function populateTrainsRowContent(departureStationName, trainsRow, departures) {
    log('Populating trains content: ' + departureStationName + ' - ' + departures.length);

    const stationNameLabel = trainsRow.addText(departureStationName);
    stationNameLabel.font = DEFAULT_FONT;
    stationNameLabel.textColor = Color.lightGray();
    stationNameLabel.centerAlignText();
    stationNameLabel.lineLimit = 1;
    trainsRow.addSpacer();

    for (let i = 0; i < departures.length && i < MAX_TRAINS; i++) {
        const departure = departures[i];
        addDeparture(trainsRow, departure);
    }
}

function addDeparture(trainsRow, departure) {
    const departureRow = trainsRow.addStack();
    departureRow.url = 'traintrack://';

    if (departure.serviceType === 'bus') {
        addBusDeparture(departureRow, departure);
    }
    else {
        const delay = getDelay(departure.departure_time.scheduled, departure.departure_time.estimated);
        addDepartureTime(departureRow, departure.departure_time.estimated, delay, departure.cancelReason);
        addDeparturePlatform(departureRow, departure.platform, departure.cancelReason);
    }
    departureRow.addSpacer();
}

// Displays a replacement bus service departure
function addBusDeparture(departureRow, departure) {
    
    const col = departureRow.addStack();
    departureTimeLabel.font = DEFAULT_FONT;
    departureTimeLabel.centerAlignText();
    departureTimeLabel.lineLimit = 1;

    // Set colours based on any delay/cancellation
    const departureColours = getBusDepartureColors();
    col.backgroundColor = departureColours.backgroundColor;
    departureTimeLabel.textColor = departureColours.foregroundColor;

    departureRow.addSpacer(10);

    const busIcon = departureRow.addText('🚌');
    busIcon.font = DEFAULT_FONT;
    busIcon.centerAlignText();
    busIcon.lineLimit = 1;
    departureRow.addSpacer(5);

}

// Returns the bus departure colours
function getBusDepartureColors() {
    return {
        backgroundColor: new Color('#ff9913'),
        foregroundColor: Color.black()
    }
}

// Returns any delay in minutes between the booked and realtime departure times which are in the format HHMM
function getDelay(bookedDepartureTime, realtimeDepartureTime) {
    // Handle edge case for departures scheduled to close to midnight but are delayed until the next day
    if (bookedDepartureTime.slice(0, 2) == '23' && realtimeDepartureTime.slice(0, 2) == '00') {
        realtimeDepartureTime += '24:00';
    }
    // Strip out the colons from the departure times
    bookedDepartureTime = bookedDepartureTime.replace(/:/g, '');
    realtimeDepartureTime = realtimeDepartureTime.replace(/:/g, '');
    // Calculate the delay in minutes
    const delay = realtimeDepartureTime - bookedDepartureTime;
    return delay;
}

function addDepartureTime(departureRow, departureTime, delay, cancelReasonCode) {

    // Add a separating colon to the departure time
    departureTime = departureTime.replace(/(\d{2})(\d{2})/, '$1:$2');

    const col = departureRow.addStack();
    col.addSpacer(2);
    const departureTimeLabel = col.addText(departureTime);
    col.addSpacer(2);
    departureTimeLabel.font = DEFAULT_FONT;

    departureTimeLabel.centerAlignText();
    departureTimeLabel.lineLimit = 1;

    // Set colours based on any delay/cancellation
    const departureColours = getDepartureColors(departureTime, delay, cancelReasonCode);
    col.backgroundColor = departureColours.backgroundColor;

    // Apply a strike-through effect if the train is cancelled 
    if (cancelReasonCode) {
        col.backgroundGradient = getStrikeThrough()
    }

    departureTimeLabel.textColor = departureColours.foregroundColor;

    departureRow.addSpacer();
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

function getDepartureColors(departureTime, delay, cancelReasonCode) {

    if (cancelReasonCode) {
        return {
            backgroundColor: new Color('#fe4c29'),
            foregroundColor: Color.white()
        }
    }
    else if (departureTime.toLowerCase().includes('delayed')) {
        return {
            backgroundColor: new Color('#ff9913'),
            foregroundColor: Color.black()
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
    else if (!platform) {
        platform = '?';
    }
    const platformLabel = departureRow.addText(platform);
    platformLabel.font = DEFAULT_FONT;
    // If the platform is not 'X' or '?', then set the text colour to white
    if (platform !== 'X' && platform !== '?') {
        platformLabel.textColor = Color.white();
    }
    else {
        platformLabel.textColor = Color.gray();
    }
    platformLabel.centerAlignText();
    platformLabel.lineLimit = 1;
    departureRow.addSpacer();
}

await populateTrainsContent();


// **********************************************
// *********** Begin footer section *************
// **********************************************
const footer = widget.addStack();

footer.addSpacer();
const lastUpdatedText = footer.addText(`Updated: ${new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: 'numeric' })}`);
footer.addSpacer();
lastUpdatedText.font = DEFAULT_FONT;
lastUpdatedText.textColor = Color.lightGray();
lastUpdatedText.lineLimit = 1;
lastUpdatedText.centerAlignText();


// Populate widget
Script.setWidget(widget)
widget.presentMedium()
Script.complete()