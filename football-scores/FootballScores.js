// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: futbol;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: magic;

const DEVICE_ID = 'D1B468E9-AC32-42C1-BB83-B7B60D3DA094'
const MAX_MATCHES = 13; // TODO: Base this on widgetFamily (i.e. small vs large, etc.)?

const SERVER_URI_DOMAIN = 'https://football-scores-api.fly.dev';

let teamLogos = {};

let widget = new ListWidget();
widget.url ='dev.skynolimit.topscores://'; 


// TODO: Reinstate this
let fixturesRequest = new Request(`${SERVER_URI_DOMAIN}/api/v1/user/${DEVICE_ID}/matches/fixtures?limit=${MAX_MATCHES}`);
let resultsRequest = new Request(`${SERVER_URI_DOMAIN}/api/v1/user/${DEVICE_ID}/matches/results?limit=${MAX_MATCHES}`);

const [fixturesJson, resultsJson] = await Promise.all([fixturesRequest.loadJSON(), resultsRequest.loadJSON()]);

const matches = await getMatches();
if (matches.length > 0) {
    setListWidgetContent(matches);
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

    // Use Promises.all to set the team logos for all matches
    await Promise.all(matches.map(match => setTeamLogos(match)));

    return matches.slice(0, MAX_MATCHES);
}

async function setTeamLogos(match) {
    const homeTeamName = match.homeTeam.names.displayName;
    const awayTeamName = match.awayTeam.names.displayName;
    if (!teamLogos[homeTeamName]) {
        const imageUrl = await getTeamLogoPath(homeTeamName);
        await setTeamLogoImage(homeTeamName, `${SERVER_URI_DOMAIN}${imageUrl}`);
    }
    if (!teamLogos[awayTeamName]) {
        const imageUrl = await getTeamLogoPath(awayTeamName);
        await setTeamLogoImage(awayTeamName, `${SERVER_URI_DOMAIN}${imageUrl}`);
    }
}

async function getTeamLogoPath(teamName) {
    const request = new Request(`${SERVER_URI_DOMAIN}/api/v1/teams/${teamName}/logo`);
    const logoJson = await request.loadJSON();
    return logoJson.logoPath;
}

async function setTeamLogoImage(teamName, imageUrl) {
    const request = new Request(imageUrl);
    const image = await request.loadImage();
    teamLogos[teamName] = image;
}

// Truncate text to fit in a list widget cell, and pad with spaces to the right
function getTextFormattedForListWidget(text, length) {
    const truncatedText = text.length > length ? text.substring(0, length - 1) : text;
    return truncatedText.padEnd(length, ' ');
}

// Centers header text by adding padding at the start relative to the length of the text
function getHeaderCentered(text) {
    switch (text) {
        case 'Today':
            return 'Today'.padStart(23, ' ');
        case 'Tomorrow':
            return 'Tomorrow'.padStart(25, ' ');
        case 'Monday':
            return 'Monday'.padStart(24, ' ');
        case 'Tuesday':
            return 'Tuesday'.padStart(23, ' ');
        case 'Wednesday':
            return 'Wednesday'.padStart(25, ' ');
        case 'Thursday':
            return 'Thursday'.padStart(25, ' ');
        case 'Friday':
            return 'Friday'.padStart(24, ' ');
        case 'Saturday':
            return 'Saturday'.padStart(25, ' ');
        case 'Sunday':
            return 'Sunday'.padStart(24, ' ');
        default:
            return text.padStart(24, ' ');
    }
}

// Returns the current time in HH:MM format
function getTimeLabel() {
    const currentTime = new Date().toISOString().split('T')[1];
    return currentTime.substring(0, 5);
}

async function setListWidgetContent(matches) {

    let previousMatchDate = matches && matches.length >= 0 ? matches[0].friendlyDateTime : null;

    for (let i = 0; i < matches.length; i++) {

        const match = matches[i];

        // Date header
        let currentMatchDate = matches[i].friendlyDateTime;
        if (i === 0 || currentMatchDate !== previousMatchDate) {
            const dateHeader = widget.addText(getHeaderCentered(currentMatchDate));
            dateHeader.font = new Font('Menlo', 12);
            dateHeader.textColor = Color.gray();
            widget.addSpacer(5);
            widget.addStack(dateHeader);
            widget.addSpacer(2);
            previousMatchDate = currentMatchDate;
        }

        const row = widget.addStack();

        // Fixture or match time
        let matchTime = '';
        if (match.timeLabel) {
            matchTime = match.timeLabel;
        }
        else if (match.kickOffTime) {
            matchTime = match.kickOffTime;
        }
        matchTime = getTextFormattedForListWidget(matchTime, 5);
        const matchTimeLabel = row.addText(matchTime);
        matchTimeLabel.font = new Font('Menlo', 12);
        matchTimeLabel.textColor = Color.gray();
        matchTimeLabel.rightAlignText();
        matchTimeLabel.lineLimit = 1;
        row.addSpacer(5);

        // Home team name
        const homeTeam = row.addText(getTextFormattedForListWidget(match.homeTeam.names.displayName, 8));
        homeTeam.font = new Font('Menlo', 12);
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
        homeTeamScoreLabel.font = new Font('Menlo', 12);
        homeTeamScoreLabel.rightAlignText();
        homeTeamScoreLabel.lineLimit = 1;

        // Score line separator
        const scoreSeparator = row.addText('- ');
        scoreSeparator.font = new Font('Menlo', 12);
        scoreSeparator.centerAlignText();
        scoreSeparator.lineLimit = 1;

        // Away team score
        let awayTeamScore = getTextFormattedForListWidget('', 2);
        if (match.awayTeam.score) {
            awayTeamScore = getTextFormattedForListWidget(match.awayTeam.score.toString(), 2);
        }
        const awayTeamScoreLabel = row.addText(awayTeamScore);
        awayTeamScoreLabel.font = new Font('Menlo', 12);
        awayTeamScoreLabel.leftAlignText();
        awayTeamScoreLabel.lineLimit = 1;
        row.addSpacer(2);

        // Away team logo
        const awayTeamLogo = row.addImage(teamLogos[match.awayTeam.names.displayName]);
        awayTeamLogo.imageSize = new Size(15, 15);
        row.addSpacer(10);

        // Away team name
        const awayTeam = row.addText(getTextFormattedForListWidget(match.awayTeam.names.displayName, 8));
        awayTeam.font = new Font('Menlo', 12);
        awayTeam.leftAlignText();
        awayTeam.lineLimit = 1;
        row.addSpacer(5);

        // TV channel
        if (match.tvInfo && match.tvInfo.channelInfo && match.tvInfo.channelInfo.fullName && typeof match.tvInfo.channelInfo.fullName === 'string') {
            const fixtureChannel = row.addText(getTextFormattedForListWidget(match.tvInfo.channelInfo.fullName, 8));
            fixtureChannel.font = new Font('Menlo', 12);
            fixtureChannel.textColor = Color.gray();
            fixtureChannel.leftAlignText();
            fixtureChannel.lineLimit = 1;
        }


        if (i < matches.length - 1 && matches[i + 1].friendlyDateTime !== currentMatchDate) {
            widget.addSpacer(10);
        }

        widget.addStack(row);
    }

    // Add footer row
    widget.addSpacer(10);
    // Get the current time in HH:MM format
    const footerText = widget.addText(`Updated: ${getTimeLabel()}`.padStart(38, ' '));
    footerText.font = new Font('Menlo', 8);
    footerText.textColor = Color.gray();
    footerText.lineLimit = 1;
}

let nextRefresh = Date.now() + (1000 * 30) // Optimistically aim for a 30 second refresh (in reality, iOS will only refresh every 10-15 minutes)
widget.refreshAfterDate = new Date(nextRefresh)

Script.setWidget(widget)
widget.presentLarge()
Script.complete()