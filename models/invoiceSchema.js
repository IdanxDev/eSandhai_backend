const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const invoiceSchema = mongoose.Schema({
    delivery: String,
    pickup: String,
    deliveryTimeId: {
        type: mongoose.Types.ObjectId,
        ref: "time"
    },
    pickupTimeId: {
        type: mongoose.Types.ObjectId,
        ref: "time"
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    //0==initiated
    //1==pending
    //2==booking confirm pickup pending
    //3==pickup initiated
    //4==pickup failed
    //5==pickup complete
    //6==processing
    //7==complete and delivery pending
    //8==out for delivery
    //9==delivery failed
    //10==delivery completed& order completed
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
    paymentId: [String],
    note: String,
    addressId: {
        type: mongoose.Types.ObjectId,
        ref: "address"
    }
}, { timestamps: true });

module.exports = mongoose.model("invoice", invoiceSchema);