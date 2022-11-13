const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const invoiceSchema = mongoose.Schema({
    delivery: String,
    pickup: String,
    deliveryTime: {
        type: mongoose.Types.ObjectId,
        ref: "time"
    },
    pickupTime: {
        type: mongoose.Types.ObjectId,
        ref: "time"
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    status: {
        type: Number,
        default: 0
    },
    isSubscribed: {
        type: Boolean,
        default: false
    },
    isMember: {
        type: Boolean,
        default: false
    },
    orderAmount: {
        type: Number,
        default: 0
    },
    orderId: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    paymentId: [String],
    note: String,
    addressId: {
        type: mongoose.Types.ObjectId,
        ref: "address"
    }
}, { timestamps: true });

module.exports = mongoose.model("invoice", invoiceSchema);