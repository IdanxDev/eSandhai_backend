const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const userSubscription = mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    orderId: {
        type: String,
        default: ""
    },
    planId: {
        type: mongoose.Types.ObjectId,
        ref: "subscription"
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    price: {
        type: Number,
        default: 0
    },
    duration: {
        type: Number,
        default: 0
    },
    usedDays: {
        type: Number,
        default: 0
    },
    pendingDays: {
        type: Number,
        default: 0
    },
    note: {
        type: String,
        default: ""
    },
    pickup: {
        type: Number,
        default: 0
    },
    delivery: {
        type: Number,
        default: 0
    },
    paymentId: {
        type: String,
        default: ""
    },
    //0==pending
    //1==paid/active
    //2==expired
    //3==payment failed
    status: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("usersubsciption", userSubscription);