const mongoose = require('mongoose');
const couponSchema = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    discount: {
        type: Number,
        default: 0
    },
    start: {
        type: Date
    },
    end: {
        type: Date
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    isExpired: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("coupon", couponSchema);