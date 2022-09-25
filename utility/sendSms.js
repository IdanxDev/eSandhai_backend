var axios = require('axios');
require('dotenv').config();
exports.sendSms = (to, message) => {

    var data = JSON.stringify({
        "messages": [
            {
                "body": message,
                "to": to,
                "from": "Laundary"
            }
        ]
    });
    console.log(data);
    let buff = Buffer.from(process.env.SMSUSER + ":" + process.env.SMSPASS).toString('base64');
    console.log(buff);
    var config = {
        method: 'post',
        url: 'https://rest.clicksend.com/v3/sms/send',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${buff}`
        },
        data: data
    };

    axios(config)
        .then(function (response) {
            console.log(JSON.stringify(response.data));
        })
        .catch(function (error) {
            console.log(error);
        });

}
