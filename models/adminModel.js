const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const adminSchema = mongoose.Schema({
    name: {
        type: String
    },
    mobileNo: {
        type: String
    },
    email: {
        type: String
    },
    role: {
        type: String,
        enum: ["admin", "manager", "clark"],
        default: "clark"
    },
    password: {
        type: String
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isMobileVerified: {
        type: Boolean,
        default: false
    },
    otp: String,
    generatedTime: [String],
    countryCode: String,
    birthDate: String
}, { timestamps: true });

userLogin.pre('save', async function (next) {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedpassword = await bcrypt.hash(this.password, salt);
        this.password = hashedpassword;
        next();
        //console.log("before called");
    }
    catch (error) {
        next(error)
    }
});
module.exports = mongoose.model("admin", adminSchema);