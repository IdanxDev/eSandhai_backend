const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const userSchema = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    mobileNo: {
        type: String,
        default: ""
    },
    email: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        enum: ["admin", "user"],
        default: "user"
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
    currentPlan: String,
    otp: String,
    generatedTime: [String],
    countryCode: String,
    birthDate: String,
    //0==active
    //1==banned
    status: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
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
module.exports = mongoose.model("users", userSchema);