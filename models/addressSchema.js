const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const addressSchema = mongoose.Schema({
    addressType: {
        type: String,
        enum: ["Home", "Office", "Other"]
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    pincode: {
        type: String
    },
    houseNo: {
        type: String
    },
    street: {
        type: String
    },
    landmark: {
        type: String
    },
    location: [Number],
    city: String,
    state: String,
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    }
}, { timestamps: true });

module.exports = mongoose.model("address", addressSchema);