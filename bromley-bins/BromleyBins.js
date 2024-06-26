// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: trash-alt;

// **********************************************
// *********** Begin widget config **************
// **********************************************

// This widget will display any bins due for collection on the following day, given a valid Bromley "bin ID" (see below for instructions).
// Note this widget is only for residents of Bromley UK.
// An accompanying app is available at https://apps.apple.com/gb/app/bromley-bins/id6504371978

// Bromley Bins config

// Get your bin ID as follows...
// 1. Enter your postcode and select your address at https://recyclingservices.bromley.gov.uk/waste/
// 2. Grab the number at the very end of the website address that loads, which should look like this: https://recyclingservices.bromley.gov.uk/waste/bin/3642936
// 3. Enter the number (e.g. 3642936) as your BIN_ID below
const BIN_ID = 3642936;

// An array of the bin names you wish to show on the widget (note that these are case sensitive and must match the names on the website exactly)
const BINS_OF_INTEREST = ['Paper & Cardboard', 'Mixed Recycling (Cans, Plastics & Glass)', 'Non-Recyclable Refuse'];

// An array of icons to show for each bin (note that the number of icons must match the number of BINS_OF_INTEREST)
const BIN_ICONS = ['📦', '♻️', '🗑️'];

// The icon (or character) to represent no bins due for collection the following day
const NO_COLLECTION_TOMORROW_ICON = '✖️';

// Server API URL - this should not need to be changed
const BROMLEY_BINS_API_URL = `https://waste-collection.fly.dev/api/v1/bin/${BIN_ID}/bins_for_tomorrow`;

// General config
const HEADER_FONT = new Font('Menlo', 14);
const ICON_FONT = new Font('Menlo-Bold', 40);


// **********************************************
// *********** Begin widget setup ***************
// **********************************************

let widget = new ListWidget();
widget.url = 'dev.skynolimit.bromleybins://';

// Optimistically aim for a 30 second refresh (in reality, iOS will only refresh every 10-15 minutes)
let nextRefresh = Date.now() + (1000 * 30);
widget.refreshAfterDate = new Date(nextRefresh);


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
    else {
        binContent = NO_COLLECTION_TOMORROW_ICON;
    }

    return binContent;
}


// **********************************************
// *********** Begin footer section *************
// **********************************************`
const body = widget.addStack();
body.layoutVertically();

const header = body.addStack();
header.addSpacer();
const headerText = header.addText('Bromley Bins');
header.addSpacer();
headerText.font = HEADER_FONT;
header.centerAlignContent();
body.addStack(header);

body.addSpacer(10);

const binIconsRow = body.addStack();
const binIconsLabel = await getBinIconsLabel();
if (binIconsLabel.length > 0) {
    binIconsRow.addSpacer();
    const binText = binIconsRow.addText(binIconsLabel);
    binIconsRow.addSpacer();
    binText.font = ICON_FONT;
    binIconsRow.centerAlignContent();
    body.addStack(binIconsRow);
}


Script.setWidget(widget);
widget.presentSmall();
Script.complete();