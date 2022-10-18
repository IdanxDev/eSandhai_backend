const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const subscriptionSchema = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    icon: {
        type: String,
        default: ""
    },
    pickup: {
        type: Number,
        default: 0
    },
    delivery: {
        type: Number,
        default: 0
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
    tag: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("subscription", subscriptionSchema);