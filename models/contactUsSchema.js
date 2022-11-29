const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const contactUsSchema = mongoose.Schema({
    email: {
        type: String,
        default: ""
    },
    subject: {
        type: String,
        default: ""
    },
    message: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("contactus", contactUsSchema);