const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const refundRequest = mongoose.Schema({
    status: {
        type: Number,
        default: 0
    },
    paymentId: {
        type: String
    },
    cancellationTime: {
        type: Date
    },
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    }
}, { timestamps: true });

module.exports = mongoose.model("refund", refundRequest);