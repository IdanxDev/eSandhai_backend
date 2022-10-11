const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const userSubscription = mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    planId: {
        type: mongoose.Types.ObjectId,
        ref: "subscription"
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
    //1==paid
    //2==expired
    orderStatus: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("usersubsciption", userSubscription);