// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: train;



// **********************************************
// *********** Begin widget config **************
// **********************************************

// Define the from and to stations
// Use station CRS codes, which can be found here: http://www.railwaycodes.org.uk/stations/station0.shtm
const FROM_STATION = 'ECR';
const TO_STATION = 'VIC';

// The maximum number of trains to show in the widget
const MAX_TRAINS = 3;

// Fonts - adjust size as needed
const DEFAULT_FONT = new Font('Menlo', 15);

// Request timeouts (in seconds)
const DEFAULT_REQUEST_TIMEOUT_SECONDS = 10;



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

    if (trainsData && trainsData.length > 0) {
        for (const data of trainsData) {
            if (data.departures) {
                const trainsRow = widget.addStack();
                trainsRow.url = 'traintrack://';
                await populateTrainsRowContent(trainsRow, data.departures);
                widget.addStack(trainsRow);
                sectionSeparator();
            }
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

function populateTrainsRowContent(trainsRow, departures) {
    log('Populating trains content: ' + departures.length);

    const stationNameLabel = trainsRow.addText(departures[0].locationDetail.crs);
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
    platformLabel.font = DEFAULT_FONT;
    platformLabel.textColor = Color.white();
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