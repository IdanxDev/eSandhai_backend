const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const membershipSchema = mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    orderId: {
        type: String,
        default: ""
    },
    purchaseDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    //0==pending
    //1==paid
    //2==expired
    status: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("membership", membershipSchema);