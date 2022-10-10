const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const orderSchema = mongoose.Schema({
    pickup: [String],
    delivery: [String],
    categoryId: {
        type: mongoose.Types.ObjectId,
        ref: "category"
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    }
}, { timestamps: true });

module.exports = mongoose.model("order", orderSchema);