const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const invoiceSchema = mongoose.Schema({
    dayWiseId: {
        type: mongoose.Types.ObjectId,
        ref: "daywises"
    },
    pickupTimeId: {
        type: mongoose.Types.ObjectId,
        ref: "daywises"
    }, deliveryTimeId: {
        type: mongoose.Types.ObjectId,
        ref: "daywises"
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    pickupInstruction: {
        type: String,
        default: ""
    },
    deliveryInstruction: {
        type: String,
        default: ""
    },
    pickupId: {
        type: mongoose.Types.ObjectId,
        ref: "addresses"
    },
    deliveryId: {
        type: mongoose.Types.ObjectId,
        ref: "addresses"
    },
    //0==initiated
    //1==pending
    //2==booking confirm pickup pending
    //3==pickup initiated
    //4==pickup failed
    //5==pickup complete
    //6==processing
    //7==complete cleaning
    //8==delivery intiated
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
    taxes: {
        type: Map,
        of: Number
    },
    couponId: {
        type: mongoose.Types.ObjectId,
        ref: "coupons"
    },
    finalAmount: {
        type: Number,
        default: 0
    },
    orderTotalAmount: {
        type: Number,
        default: 0
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    pendingAmount: {
        type: Number,
        default: 0
    },
    refundAmount: {
        type: Number,
        default: 0
    },
    orderId: {
        type: String,
        default: ""
    },
    invoiceId: {
        type: String,
        default: ""
    },
    paymentId: [String],
    note: String,
    pickupAddressId: {
        type: mongoose.Types.ObjectId,
        ref: "address"
    },
    deliveryAddressId: {
        type: mongoose.Types.ObjectId,
        ref: "address"
    },

}, { timestamps: true });

module.exports = mongoose.model("invoice", invoiceSchema);