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
    //2==processing
    //3==completed
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