var express = require('express');
var router = express.Router();
const stripe = require('stripe')('sk_test_51MGvznGi7bwABort1GkoMw0gP2OhxTaDTPgl0H49MNOxE2MSGB4PaQPbxhMBO7haNC3CfVnIEQlr1VxxXTNCl64f000JIV2KNx');

// stripe.checkout.sessions.create({
//     payment_method_types: ['card'],
//     line_items: [
//         {
//             price_data: {
//                 currency: 'usd',
//                 unit_amount: 2000,
//                 product_data: {
//                     name: 'T-shirt',
//                     description: 'Comfortable cotton t-shirt',
//                     images: ['https://example.com/t-shirt.png'],
//                 },
//             },
//             quantity: 1,
//         }],
//     mode: 'payment',
//     success_url: 'https://example.com/success',
//     cancel_url: 'https://example.com/cancel',
// }, function (err, session) {
//     if (err) {
//         console.log(err);
//     } else {
//         console.log(session.url);
//     }
// });

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
