const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const proofSchema = mongoose.Schema({
    image: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Types.ObjectId
    },
    title: {
        type: String,
        default: ""
    },
    isVerified: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("proof", proofSchema);