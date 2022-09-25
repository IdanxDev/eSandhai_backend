var express = require('express');
var router = express.Router();
const moment = require('moment');
const momentTz = require('moment-timezone')
require('dotenv').config();
const { default: mongoose } = require('mongoose');
const userSchema = require('../models/userModel');
const { getCurrentDateTime24 } = require('../utility/dates');
const nodemailer = require("nodemailer");
const { sendSms } = require('../utility/sendSms');
const { generateAccessToken, authenticateToken } = require('../middleware/auth');

/* GET home page. */
router.get('/', async function (req, res, next) {
    console.log(validatePhoneNumber("9999999999"));
    console.log(validateEmail("abc@gmail.com"))
    res.render('index', { title: 'Express' });
});
router.post('/signUp-Old', async (req, res, next) => {
    try {
        const { name, email, password, mobileNo } = req.body;

        let checkExist = await userSchema.aggregate([
            {
                $match: {
                    $or: [
                        { mobileNo: mobileNo },
                        { email: email }
                    ]
                }
            }
        ]);

        if (checkExist.length > 0) {
            return res.status(409).json({ issuccess: true, data: { acknowledgement: false }, message: "user already exist" });
        }

        // const userLoginIs = new userLogin({
        //   userName: userName,
        //   password: password
        // });

        // await userLoginIs.save();

        const userIs = new userSchema({
            name: name,
            email: email,
            mobileNo: mobileNo,
            password: password
        });

        await userIs.save();

        let user = {
            name: name,
            mobileNo: mobileNo
        }

        res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: user }, message: "user successfully signed up" });
        otp = getRandomIntInclusive(111111, 999999);
        console.log(otp);
        let update = await userSchema.findByIdAndUpdate(userIs._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
        let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
        await main(email, message);
        return;
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/signUp', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        let checkExist = await userSchema.aggregate([
            {
                $match: {
                    $or: [
                        { email: email }
                    ]
                }
            }
        ]);

        if (checkExist.length > 0) {
            return res.status(409).json({ issuccess: true, data: { acknowledgement: false }, message: "user already exist" });
        }

        // const userLoginIs = new userLogin({
        //   userName: userName,
        //   password: password
        // });

        // await userLoginIs.save();

        const userIs = new userSchema({
            email: email,
            password: password
        });

        await userIs.save();

        otp = getRandomIntInclusive(111111, 999999);

        console.log(otp);
        let update = await userSchema.findByIdAndUpdate(userIs._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
        let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
        await main(email, message);
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { email: userIs.email, role: userIs.role, isEmailVerified: userIs.isEmailVerified, isMobileVerified: userIs.isMobileVerified, _id: userIs._id }, otp: otp }, Messsage: "user successfully signed up" });;
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/login-mobile', async (req, res, next) => {
    try {
        const { mobileNo, countryCode } = req.body;

        let checkExist = await userSchema.aggregate([
            {
                $match: {
                    $or: [
                        { mobileNo: mobileNo }
                    ]
                }
            }
        ]);

        if (checkExist.length > 0) {
            otp = getRandomIntInclusive(111111, 999999);
            res.status(200).json({ issuccess: true, data: { acknowledgement: true, otp: otp, exist: true }, message: "otp sent to mobile no" });

            console.log(otp);
            let update = await userSchema.findByIdAndUpdate(checkExist[0]._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
            let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
            await sendSms(countryCode + mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);
            return;
            // return res.status(409).json({ IsSuccess: true, Data: [], Messsage: "user already exist" });
        }

        // const userLoginIs = new userLogin({
        //   userName: userName,
        //   password: password
        // });

        // await userLoginIs.save();

        const userIs = new userSchema({
            mobileNo: mobileNo,
            countryCode: countryCode
        });

        await userIs.save();

        otp = getRandomIntInclusive(111111, 999999);
        res.status(200).json({ issuccess: true, data: { acknowledgement: true, otp: otp, exist: false }, message: "otp sent to mobile no" });

        console.log(otp);
        let update = await userSchema.findByIdAndUpdate(userIs._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
        let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
        await sendSms(countryCode + mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);
        return;
    } catch (error) {
        console.log();
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/login', async (req, res, next) => {
    try {
        const { password, id } = req.body;

        isEmail = false;
        if (validateEmail(id)) {
            isEmail = true
        }
        else if (validatePhoneNumber(id)) {
            isEmail = false;
        }
        else {
            return res.status(400).json({ issuccess: true, data: { acknowledgement: false }, message: "please use correct mobile no or email" });
        }

        if (isEmail) {
            checkExist = await userSchema.aggregate([
                {
                    $match: {
                        email: id
                    }
                }
            ]);
        }
        else {
            checkExist = await userSchema.aggregate([
                {
                    $match: {
                        email: id
                    }
                }
            ]);
        }


        if (checkExist.length > 0) {
            if (checkExist[0].password != password) {
                return res.status(401).json({ issuccess: true, data: { acknowledgement: false }, message: "Incorrect Password" });
            }
            // let user = {
            //     _id: checkExist[0]._id,
            //     timestamp: Date.now()
            // }

            // const { generatedToken, refreshToken } = await generateAccessToken(user);
            // // console.log(generatedToken + refreshToken);
            //SEND OTP
            //
            // main().catch(console.error);
            otp = getRandomIntInclusive(111111, 999999);
            res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkExist, otp: otp }, message: "user found" });
            let update = await userSchema.findByIdAndUpdate(checkExist[0]._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
            let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
            await main(checkExist[0].email, message);
            return
        }
        return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: "user not found" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: error.message || "Having issue is server" })
    }
})
router.post('/updateUser', authenticateToken, async (req, res, next) => {
    try {
        const { name, birthDate, mobileNo, email, isVerify } = req.body;

        const userId = req.user._id

        let checkEmail = await userSchema.aggregate([
            {
                $match: {
                    $or: [
                        {
                            $and: [
                                { _id: { $ne: mongoose.Types.ObjectId(userId) } },
                                { email: email }
                            ]
                        },
                        {
                            $and: [
                                { _id: { $ne: mongoose.Types.ObjectId(userId) } },
                                { mobileNo: mobileNo }
                            ]
                        }
                    ]
                }
            }
        ])
        let updateUser = await userSchema.findByIdAndUpdate(userId, { email: email, name: name, mobileNo: mobileNo, birthDate: birthDate }, { new: true })
        if (isVerify) {
            if (email != undefined && validateEmail(email)) {
                otp = getRandomIntInclusive(111111, 999999);
                res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { email: updateUser.email }, otp: otp }, message: "user found" });
                let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
                let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
                await main(checkExist[0].email, message);
            }
            else if (mobileNo != undefined && validatePhoneNumber(mobileNo)) {
                otp = getRandomIntInclusive(111111, 999999);
                res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { mobileNo: updateUser.mobileNo }, otp: otp }, message: "otp sent to mobile no" });

                console.log(otp);
                let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
                let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
                await sendSms(countryCode + mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);

            }
        }
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { name: updateUser.name, birthDate: updateUser.birthDate } }, message: "user details updated" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})

router.post('/resendOtp', async (req, res, next) => {
    try {
        const { id } = req.body;

        console.log(id);
        let checkOtp = await userSchema.aggregate([
            {
                $match: {
                    $and: [
                        { $or: [{ email: id }, { mobileNo: id }] }
                    ]
                }
            }
        ])
        if (checkOtp.length == 0) {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: false }, messsage: "having issue with otp" });
        }

        otp = getRandomIntInclusive(111111, 999999);
        res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: otp }, messsage: "Otp sent successfully" });

        let update = await userSchema.findByIdAndUpdate(checkOtp[0]._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
        let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`

        if (validateEmail(id)) {
            await main(checkOtp[0].email, message);
        }
        else if (validatePhoneNumber(id)) {
            await sendSms(checkOtp[0].countryCode + checkOtp[0].mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);
        }
        return

        return res.status(404).json({ IsSuccess: true, Data: [], Messsage: "user not found" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
//authenticate otp and update for verified status
router.post('/authenticateOtpLogin', async (req, res, next) => {
    try {
        const { otp, id } = req.body;

        let checkUser = await userSchema.aggregate([
            {
                $match: {
                    $or: [
                        { email: id },
                        { mobileNo: id }
                    ]
                }
            }
        ]);

        if (checkUser.length == 0) {
            return res.status(404).json({ issuccess: true, data: { acknowledgement: false, status: 3 }, messsage: `No User Found With ${id}` });
        }
        if (checkUser[0].isVerified) {
            return res.status(409).json({ issuccess: true, data: { acknowledgement: false, status: 4 }, message: `User already verified` });
        }

        const startIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss')).tz('Asia/Kolkata'));
        const endIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes')).tz('Asia/Kolkata'));
        const timeIs = (momentTz().tz('Asia/Kolkata'));
        // const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
        // const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
        // const timeIs = moment();
        console.log(startIs)
        console.log(endIs);
        console.log(timeIs);
        if (timeIs >= startIs && timeIs <= endIs) {
            //otp valid
            if (checkUser[0].otp == otp) {
                let updateData = {}
                if (validateEmail(id)) {
                    updateData = {
                        isEmailVerified: true
                    }
                }
                else if (validatePhoneNumber(id)) {
                    updateData = {
                        isMobileVerified: false
                    }
                }
                console.log(checkUser[0].otp);
                let update = await userSchema.findByIdAndUpdate(checkUser[0]._id, updateData, { new: true });
                const {
                    generatedToken, refreshToken } = await generateAccessToken({ _id: checkUser[0]._id })
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, status: 0, generatedToken: generatedToken, refreshToken: refreshToken }, message: `otp verifed successfully` });
            }
            else {
                return res.status(401).json({ issuccess: true, data: { acknowledgement: false, status: 2 }, messsage: `incorrect otp` });
            }
            console.log("valid")
        }
        else {
            //otp expired
            return res.status(410).json({ issuccess: true, data: { acknowledgement: false, status: 1 }, message: `otp expired` });
        }

    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})

//return response for otp verification only
router.post('/authenticateOtp', async (req, res, next) => {
    try {
        const { otp, id } = req.body;

        let checkUser = await userSchema.aggregate([
            {
                $match: {
                    $or: [
                        { email: id },
                        { mobileNo: id }
                    ]
                }
            }
        ]);

        if (checkUser.length == 0) {
            return res.status(404).json({ issuccess: true, data: { acknowledgement: false, status: 3 }, messsage: `No User Found With ${userId}` });
        }

        const startIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss')).tz('Asia/Kolkata'));
        const endIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes')).tz('Asia/Kolkata'));
        const timeIs = (momentTz().tz('Asia/Kolkata'));
        // const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
        // const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
        // const timeIs = moment();
        console.log(startIs)
        if (timeIs >= startIs && timeIs <= endIs) {
            //otp valid
            if (checkUser[0].otp == otp) {
                const {
                    generatedToken, refreshToken } = await generateAccessToken({ _id: checkUser[0]._id })
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, status: 0, generatedToken: generatedToken, refreshToken: refreshToken }, messsage: `otp verifed successfully` });
            }
            else {
                return res.status(401).json({ issuccess: true, data: { acknowledgement: false, status: 2 }, messsage: `incorrect otp` });
            }
            console.log("valid")
        }
        else {
            //otp expired
            return res.status(410).json({ issuccess: true, data: { acknowledgement: false, status: 1 }, messsage: `otp expired` });
        }

    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})

router.get('/getUsers', async (req, res) => {
    let getUsers = await userSchema.aggregate([
        {
            $match: {

            }
        }
    ])
    return res.status(410).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, messsage: getUsers.length > 0 ? `users found` : "no user found" });
})
function validateEmail(emailAdress) {
    let regexEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (emailAdress.match(regexEmail)) {
        return true;
    } else {
        return false;
    }
}
function validatePhoneNumber(input_str) {
    var re = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})$/;

    return re.test(input_str);
}
function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}
// async..await is not allowed in global scope, must use a wrapper
async function main(email, message) {
    console.log("execute0")
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    let testAccount = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER, // generated ethereal user
            pass: process.env.PASSWORD, // generated ethereal password
        },
    });

    // send mail with defined transport object
    let info = await transporter.sendMail({
        from: 'itsme@gmail.com', // sender address
        to: email, // list of receivers
        subject: "Hello ✔", // Subject line
        text: "Hello world?", // plain text body
        html: message, // html body
    });

    console.log("Message sent: %s", info.messageId);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}

module.exports = router;
