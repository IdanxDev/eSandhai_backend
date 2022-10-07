const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const categorySchema = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    icon: {
        type: String,
        default: ""
    },
    isVisible: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model("category", categorySchema);