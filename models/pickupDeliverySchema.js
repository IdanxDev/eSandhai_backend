const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const pickupDeliverySchema = mongoose.Schema({
    riderId: {
        type: mongoose.Types.ObjectId,
        ref: "riders"
    },
    startCordinates: [{
        type: Number
    }],
    endCordinates: [{
        type: Number
    }],
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    //0==pickup
    //1==delivery
    //2==return
    rideType: {
        type: Number,
        default: 0,
        enum: [0, 1, 2]
    },
    //0==Assigned
    //1==out
    //2==complete
    //3==fail
    //4==failed for pickup
    //5==cancelled by rider
    status: {
        type: Number,
        default: 0
    },
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    }
}, { timestamps: true });

module.exports = mongoose.model("pickupdelivery", pickupDeliverySchema);