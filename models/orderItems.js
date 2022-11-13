const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const orderItems = mongoose.Schema({
    itemId: {
        type: mongoose.Types.ObjectId,
        ref: "item"
    },
    qty: {
        type: Number,
        default: 0
    },
    amount: {
        type: Number,
        default: 0
    },
    categoryId: {
        type: mongoose.Types.ObjectId,
        ref: "categories"
    },
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    }
}, { timestamps: true });

module.exports = mongoose.model("orderitem", orderItems);