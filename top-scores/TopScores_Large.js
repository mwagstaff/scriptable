// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: futbol;

// Maximum number of matches to show
// Note that showing too many matches may cause the widget to hit the iOS memory limit,
// resulting in the widget not updating. This is an OS limitation, not a Scriptable limitation.
const MAX_MATCHES = 12;

// API server URI
const FOOTBALL_SERVER_URI_DOMAIN = 'https://football-scores-api.fly.dev';

// Device ID - this should match your device ID in the Top Scores app (found at the bottom of the Settings screen)
const DEVICE_ID = '{DEVICE_ID}';

// Show only matches on TV or not
const SHOW_ONLY_MATCHES_ON_TV = '{TV_ONLY}';

// Request timeouts (in seconds)
const DEFAULT_REQUEST_TIMEOUT_SECONDS = 10;

// Fonts
const DEFAULT_FONT = new Font('Menlo', 10);
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
    widget.addSpacer(8);
    let hline = widget.addStack();
    hline.size = new Size(0, 1);
    hline.backgroundColor = Color.darkGray();
    hline.addSpacer();
    widget.addSpacer(8);
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
// *********** Begin main code  *****************
// **********************************************

let teamLogos = {};

widget.url = 'dev.skynolimit.topscores://';

let nextRefresh = Date.now() + (1000 * 30) // Optimistically aim for a 30 second refresh (in reality, iOS will only refresh every 10-15 minutes)
widget.refreshAfterDate = new Date(nextRefresh)

const [fixturesJson, resultsJson] = await Promise.all([
    getJson(`${FOOTBALL_SERVER_URI_DOMAIN}/api/v1/matches/fixtures?limit=${MAX_MATCHES}`),
    getJson(`${FOOTBALL_SERVER_URI_DOMAIN}/api/v1/matches/results?limit=${MAX_MATCHES}`),
]);

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

Script.setWidget(widget)
widget.presentLarge()
Script.complete()