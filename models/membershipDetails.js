const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const membershipDetail = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    icon: {
        type: String,
        default: ""
    },
    month: {
        type: Number,
        default: 0
    },
    quarterly: {
        type: Number,
        default: 0
    },
    year: {
        type: Number,
        default: 0
    },
    isVisible: {
        type: Boolean,
        default: false
    },
    benefits: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("membershipdetail", membershipDetail);