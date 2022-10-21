const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const vehicleSchema = mongoose.Schema({
    insurance: {
        type: Boolean,
        default: false
    },
    riderInsurance: {
        type: String,
        default: ""
    },
    riderExpiry: {
        type: String,
        default: ""
    },
    registrationNo: {
        type: String,
        default: ""
    },
    registrationDate: {
        type: String,
        default: ""
    },
    chassisNo: {
        type: String,
        default: ""
    },
    engineNo: {
        type: String,
        default: ""
    },
    ownerName: {
        type: String,
        default: ""
    },
    vehicleClass: {
        type: String,
        default: ""
    },
    fuel: {
        type: String,
        default: ""
    },
    model: {
        type: String,
        default: ""
    },
    manufacturer: {
        type: String,
        default: ""
    },
    vehicleInsurance: {
        type: Boolean,
        default: false
    },
    insuranceNumber: {
        type: String,
        default: ""
    },
    insuranceExpiry: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("vehicle", vehicleSchema);