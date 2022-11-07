const moment = require('moment-timezone')
const momentIs = require('moment')
exports.validateEmail = (emailAdress) => {
    let regexEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return regexEmail.test(emailAdress.match(regexEmail))
}
exports.validatePhoneNumber = (input_str) => {
    var re = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})$/;
    return re.test(input_str);
}
exports.makeid = (length) => {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
exports.getCurrentDateTime = (timeZone) => {
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
exports.getCurrentDateTime24 = (timeZone) => {
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
exports.convertTime12to24 = (time12h) => {
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

exports.add15Minutes = (time) => {
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
exports.sub15Minutes = (time) => {
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
exports.convertDateFormat = (date) => {
    date = date.split("/");
    return `${date[2]}/${date[1]}/${date[0]}`;
}

exports.addTime = (dateMoment, modifyMoment) => {
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