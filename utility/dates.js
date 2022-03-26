const moment = require('moment-timezone')
const momentIs = require('moment')
function getCurrentDateTime(timeZone) {
    let date = moment()
        .tz(timeZone)
        .format("DD/MM/YYYY,h:mm:ss a")
        .split(",")[0];

    let time = moment()
        .tz(timeZone)
        .format("DD/MM/YYYY,h:mm:ss a")
        .split(",")[1];

    return [date, time];
}
function getCurrentDateTime24(timeZone) {
    let date = moment()
        .tz(timeZone)
        .format("DD/MM/YYYY,H:mm:ss a")
        .split(",")[0];

    let time = moment()
        .tz(timeZone)
        .format("DD/MM/YYYY,H:mm:ss a")
        .split(",")[1];

    return [date, time];
}
async function convertTime12to24(time12h) {
    const [time, modifier] = time12h.split(" ");

    let [hours, minutes, second] = time.split(":");

    if (hours === "12") {
        hours = "00";
    }

    if (modifier === "PM") {
        hours = parseInt(hours, 10) + 12;
    }

    return `${hours}:${minutes}:${second}`;
}

function add15Minutes(time) {
    console.log("time is" + time)
    let [hours, minutes, second] = time.split(":");

    hours = parseInt(hours);
    minutes = parseInt(minutes);
    second = parseInt(second)
    for (i = 0; i < 15; i++) {
        if (minutes == 59) {
            minutes = 00;
            if (hours == 23) {
                hours = 00;
            }
            else {
                hours += 1;
            }
        }
        else {
            minutes += 1
        }
    }
    if (hours < 10) {
        hours = "0" + hours
    }
    if (minutes < 10) {
        minutes = "0" + minutes
    }
    if (second < 10) {
        second = "0" + second
    }
    return `${hours}:${minutes}:${second}`;
}
function sub15Minutes(time) {
    console.log("time is" + time)
    let [hours, minutes, second] = time.split(":");

    hours = parseInt(hours);
    minutes = parseInt(minutes);
    second = parseInt(second)
    for (i = 0; i < 15; i++) {
        if (minutes == 00) {
            minutes = 59;
            if (hours == 00) {
                hours = 23;
            }
            else {
                hours -= 1;
            }
        }
        else {
            minutes -= 1
        }
    }
    if (hours < 10) {
        hours = "0" + hours
    }
    if (minutes < 10) {
        minutes = "0" + minutes
    }
    if (second < 10) {
        second = "0" + second
    }
    return `${hours}:${minutes}:${second}`;
}
function convertDateFormat(date) {
    date = date.split("/");
    return `${date[2]}/${date[1]}/${date[0]}`;
}

function addTime(dateMoment, modifyMoment) {
    // console.log(dateMoment)
    // console.log(modifyMoment)
    timeIs = modifyMoment.split(":");
    // console.log(momentIs(dateMoment))
    let hourUpdated = momentIs(dateMoment).add(timeIs[0], 'hours');
    let minuteUpdated = momentIs(hourUpdated).add(timeIs[1], 'minutes')
    let secondUpdated = momentIs(minuteUpdated).add(timeIs[2], 'seconds');
    // console.log(hourUpdated);
    // console.log(minuteUpdated);
    // console.log(secondUpdated);

    return secondUpdated;
}
module.exports = { getCurrentDateTime: getCurrentDateTime, addTime: addTime, getCurrentDateTime24: getCurrentDateTime24, convertDateFormat: convertDateFormat, convertTime12to24: convertTime12to24, add15Minutes: add15Minutes, sub15Minutes: sub15Minutes }