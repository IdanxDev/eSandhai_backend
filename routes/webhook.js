var express = require('express');
var router = express.Router();
router.post('/webhook', function (request, response) {
    let event;
    try {
        event = request.body;
        console.log(request.body);
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'charge.succeeded':
            // Payment was successful
            // Update the database and send a confirmation email to the customer
            break;
        case 'charge.failed':
            // Payment failed
            // Update the database and send an email to the customer
            break;
        case 'charge.refunded':
            // Payment was refunded
            // Update the database and send a refund email to the customer
            break;
        default:
            // Unexpected event type
            return response.status(400).end();
    }
})

module.exports = router;
