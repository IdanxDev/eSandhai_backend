const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const pickupDeliverySchema = mongoose.Schema({
    riderId: {
        type: mongoose.Types.ObjectId,
        ref: "riders"
    },
    //0==Assigned
    //1==out
    //2==complete
    //3==fail
    //4==failed for pickup
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