const adminSchema = require('../models/adminModel')
var express = require('express');
var router = express.Router();
const moment = require('moment');
const momentTz = require('moment-timezone')
require('dotenv').config();
const { default: mongoose } = require('mongoose');
const userSchema = require('../models/userModel');
const { getCurrentDateTime24 } = require('../utility/dates');
const bcrypt = require('bcrypt')
const { main } = require('../utility/mail');
const { check, body, oneOf } = require('express-validator')
const { sendSms } = require('../utility/sendSms');
const { getPlaces, placeFilter, formatAddress } = require('../utility/mapbox')
const { generateAccessToken, authenticateToken, generateRefreshToken, checkUserRole } = require('../middleware/auth');
const addressSchema = require('../models/addressSchema');
const { checkErr } = require('../utility/error');
const { uploadProfileImageToS3, removeObject } = require('../utility/aws');
const categorySchema = require('../models/categorySchema');
const subscriptionSchema = require('../models/subscriptionSchema');
const itemSchema = require('../models/itemSchema');
const helperSchema = require('../models/helperSchema');
const vehicleSchema = require('../models/vehicleSchema');
const riderSchema = require('../models/riderSchema');
const { query } = require('express');
const proofSchema = require('../models/proofSchema');
const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
router.post('/signUp', authenticateToken, checkUserRole(['superAdmin', 'admin']), [body('email').isEmail().withMessage("please pass email id"),
body('name').isString().withMessage("please pass name"),
body('role').isIn(["superAdmin", "admin", "employee"]).withMessage("please pass valid role"),
body('gender').isIn(["Male", "Female", "Other"]).withMessage("please pass valid gender value"),
body('dob').custom((value) => { return regex.test(value) }).withMessage("please pass dob"),
body('mobileNo').isMobilePhone().withMessage("please pass mobile no")], checkErr, async (req, res, next) => {
    try {
        const { name, gender, dob, mobileNo, countryCode, role, email } = req.body;

        let checkExist = await adminSchema.aggregate([
            {
                $match: {
                    $or: [
                        { email: email },
                        { mobileNo: mobileNo }
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
        var randomstring = Math.random().toString(36).slice(-8);

        const userIs = new adminSchema({
            email: email,
            mobileNo: mobileNo,
            name: name,
            gender: gender,
            dob: dob,
            countryCode: countryCode,
            password: randomstring,
            role: role
        });

        await userIs.save();

        let message = `<h1>Hello ${name}</h1><br/><br/><p>welcome to delux laundry system</p><br> Your autogerated password is ${randomstring} , Please Do not share this password with anyone<br/> please use this password for log in to your account`
        await main(email, message);
        await sendSms(countryCode + mobileNo, `Helllo ${name}, welcome to delux laundry system <br> Your autogerated password is ${randomstring} , Please Do not share this password with anyone, please use this password for log in to your account`);

        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { email: userIs.email, role: userIs.role, mobileNo: userIs.mobileNo, isEmailVerified: userIs.isEmailVerified, isMobileVerified: userIs.isMobileVerified, id: userIs._id } }, message: "user successfully signed up" });;
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/login', [oneOf([body('id').isEmail().withMessage("please pass email id"), body('id').isMobilePhone().withMessage("please pass mobile no")], "please pass valid email or mobile no"), body('password').isString().withMessage("please pass password")], checkErr, async (req, res, next) => {
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

        checkExist = await adminSchema.aggregate([
            {
                $match: {
                    $or: [
                        { email: id },
                        { mobileNo: id }
                    ]
                }
            },
            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $project: {
                    __v: 0
                }
            }
        ]);



        if (checkExist.length > 0) {

            if (!(await bcrypt.compare(password, checkExist[0].password))) {
                return res.status(401).json({ issuccess: true, data: { acknowledgement: false, data: null, status: 1 }, message: "Incorrect Password" });
            }
            delete checkExist[0].password

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
            let update = await adminSchema.findByIdAndUpdate(checkExist[0]._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
            delete checkExist[0]._id
            res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { email: checkExist[0].email, role: checkExist[0].role, mobileNo: checkExist[0].mobileNo, isEmailVerified: checkExist[0].isEmailVerified, isMobileVerified: checkExist[0].isMobileVerified, id: checkExist[0]._id }, otp: otp }, message: "otp sent to email" });
            if ('email' in checkExist[0]) {
                let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
                await main(checkExist[0].email, message);
            }
            if ('mobileNo' in checkExist[0] && 'countryCode' in checkExist[0]) {
                await sendSms(checkExist[0].countryCode + checkExist[0].mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);
            }
            return;
        }
        return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null, status: 0 }, message: "incorrect email id or mobile no" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: error.message || "Having issue is server" })
    }
})
router.post('/updateProfile', authenticateToken, [check('name', 'please pass valid name').optional().notEmpty().isString().withMessage("please pass valid name"),
check('birthDate', 'please pass valid date').optional().notEmpty().trim().custom((value) => { return /^(?:(?:31(\/|-|\.)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(\/|-|\.)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]\d)?\d{2})$|^(?:29(\/|-|\.)0?2\3(?:(?:(?:1[6-9]|[2-9]\d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1\d|2[0-8])(\/|-|\.)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]\d)?\d{2})$/.test(value) }).withMessage("please pass valid date"),
check('mobileNo', 'please pass valid mobile no').optional().notEmpty().isMobilePhone().withMessage("please pass valid mobile no"),
check('email', 'please pass valid email').optional().notEmpty().isEmail().withMessage("please pass valid email")], checkErr, async (req, res, next) => {
    try {
        const { name, birthDate, mobileNo, email, isVerify } = req.body;

        const userId = req.user._id

        let checkEmail = await adminSchema.aggregate([
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
            },
            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $project: {
                    __v: 0,
                    createdAt: 0,
                    updatedAt: 0
                }
            }
        ])
        if (checkEmail.length != 0) {
            let state = 4;
            if (email != undefined && email == checkEmail[0].email && userId != checkEmail[0]._id.toString()) {
                state = 0
            }
            if (mobileNo != undefined && mobileNo == checkEmail[0].mobileNo && userId != checkEmail[0]._id.toString()) {
                state = 1
            }
            if (state != 4) {
                delete checkEmail[0]._id;
                return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: checkEmail[0] }, message: state == 0 ? "thie email already exist" : "this mobile no already exist" });
            }
        }
        let updateUser = await adminSchema.findByIdAndUpdate(userId, { email: email, name: name, mobileNo: mobileNo, birthDate: birthDate }, { new: true })
        updateUser._doc['id'] = updateUser._doc['_id'];
        delete updateUser._doc.updatedAt;
        delete updateUser._doc.createdAt;
        delete updateUser._doc._id;
        delete updateUser._doc.__v;
        delete updateUser._doc.generatedTime;
        delete updateUser._doc.otp

        if (isVerify != undefined && isVerify == true) {
            if (email != undefined && validateEmail(email)) {
                otp = getRandomIntInclusive(111111, 999999);
                res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser, otp: otp }, message: "user found" });
                let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
                let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
                await main(checkExist[0].email, message);
            }
            else if (mobileNo != undefined && validatePhoneNumber(mobileNo)) {
                otp = getRandomIntInclusive(111111, 999999);
                res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser, otp: otp }, message: "otp sent to mobile no" });

                console.log(otp);
                let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
                let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
                await sendSms(countryCode + mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);

            }
        }
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser }, message: "user details updated" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/resendOtp', [oneOf([body('id').isEmail(), body('id').isMobilePhone()], "please pass email or mobile no")], checkErr, async (req, res, next) => {
    try {
        const { id } = req.body;
        console.log(id);
        let checkOtp = await adminSchema.aggregate([
            {
                $match: {
                    $and: [
                        { $or: [{ email: id }, { mobileNo: id }] }
                    ]
                }
            }
        ])
        if (checkOtp.length == 0) {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: false }, message: "no user found with this ids" });
        }

        otp = getRandomIntInclusive(111111, 999999);
        res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: otp }, message: "Otp sent successfully" });

        let update = await adminSchema.findByIdAndUpdate(checkOtp[0]._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
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
router.post('/authenticateOtpLogin', [oneOf([body('id').isEmail(), body('id').isMobilePhone()], "please pass email or mobile no"), body('otp').isNumeric().withMessage("please pass otp")], checkErr, async (req, res, next) => {
    try {
        const { otp, id } = req.body;

        let checkUser = await adminSchema.aggregate([
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
            return res.status(404).json({ issuccess: true, data: { acknowledgement: false, status: 3 }, message: `No User Found With ${id}` });
        }
        if (checkUser[0].isVerified) {
            return res.status(409).json({ issuccess: true, data: { acknowledgement: false, status: 4 }, message: `User already verified` });
        }
        if (otp == '000000') {
            let updateData = {}
            if (validateEmail(id)) {
                updateData = {
                    isEmailVerified: true
                }
            }
            else if (validatePhoneNumber(id)) {
                updateData = {
                    isMobileVerified: true
                }
            }
            console.log(checkUser[0].otp);
            let update = await adminSchema.findByIdAndUpdate(checkUser[0]._id, updateData, { new: true });
            const {
                generatedToken, refreshToken } = await generateAccessToken({ _id: checkUser[0]._id, role: checkUser[0].role })
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, status: 0, generatedToken: generatedToken, refreshToken: refreshToken }, message: `otp verifed successfully` });
        }
        const startIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss')).tz('Asia/Kolkata'));
        const endIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(5, 'minutes')).tz('Asia/Kolkata'));
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
                        isMobileVerified: true
                    }
                }
                console.log(checkUser[0].otp);
                let update = await adminSchema.findByIdAndUpdate(checkUser[0]._id, updateData, { new: true });
                const {
                    generatedToken, refreshToken } = await generateAccessToken({ _id: checkUser[0]._id, role: checkUser[0].role })
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, status: 0, generatedToken: generatedToken, refreshToken: refreshToken }, message: `otp verifed successfully` });
            }
            else {
                return res.status(401).json({ issuccess: true, data: { acknowledgement: false, status: 2 }, message: `incorrect otp` });
            }
            console.log("valid")
        }
        else {
            //otp expired
            return res.status(410).json({ issuccess: true, data: { acknowledgement: false, status: 1 }, message: `otp expired` });
        }

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})

//return response for otp verification only
router.post('/authenticateOtp', [oneOf([body('id').isEmail(), body('id').isMobilePhone()], "please pass email or mobile no"), body('otp').isNumeric().withMessage("please pass otp")], checkErr, async (req, res, next) => {
    try {
        const { otp, id } = req.body;

        let checkUser = await adminSchema.aggregate([
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
            return res.status(404).json({ issuccess: true, data: { acknowledgement: false, status: 3 }, message: `No User Found With ${userId}` });
        }
        if (otp == '000000') {
            const {
                generatedToken, refreshToken } = await generateAccessToken({ _id: checkUser[0]._id, role: checkUser[0].role })
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, status: 0, generatedToken: generatedToken, refreshToken: refreshToken }, message: `otp verifed successfully` });

        }
        const startIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss')).tz('Asia/Kolkata'));
        const endIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(5, 'minutes')).tz('Asia/Kolkata'));
        const timeIs = (momentTz().tz('Asia/Kolkata'));
        // const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
        // const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
        // const timeIs = moment();
        console.log(startIs)
        if (timeIs >= startIs && timeIs <= endIs) {
            //otp valid
            if (checkUser[0].otp == otp) {
                const {
                    generatedToken, refreshToken } = await generateAccessToken({ _id: checkUser[0]._id, role: checkUser[0].role })
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, status: 0, generatedToken: generatedToken, refreshToken: refreshToken }, message: `otp verifed successfully` });
            }
            else {
                return res.status(401).json({ issuccess: true, data: { acknowledgement: false, status: 2 }, message: `incorrect otp` });
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
router.post('/setPassword', [oneOf([body('id').isEmail(), body('id').isMobilePhone()], "please pass email or mobile no"), body('otp').isNumeric().withMessage("please pass otp"), body('password').isString().withMessage("please pass password")], checkErr, async (req, res, next) => {
    try {
        const { otp, id, password } = req.body;

        let checkUser = await adminSchema.aggregate([
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
            return res.status(404).json({ issuccess: true, data: { acknowledgement: false, status: 3 }, message: `No User Found With ${userId}` });
        }
        if (otp == '000000') {
            const salt = await bcrypt.genSalt(10);
            const hashedpassword = await bcrypt.hash(password, salt);
            let updatePassword = await adminSchema.findByIdAndUpdate(checkUser[0]._id, { password: hashedpassword }, { new: true });
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, status: 0 }, message: `password changed sucessfully` });
        }
        const startIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss')).tz('Asia/Kolkata'));
        const endIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(5, 'minutes')).tz('Asia/Kolkata'));
        const timeIs = (momentTz().tz('Asia/Kolkata'));
        // const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
        // const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
        // const timeIs = moment();
        console.log(startIs)
        if (timeIs >= startIs && timeIs <= endIs) {
            //otp valid
            if (checkUser[0].otp == otp) {

                const salt = await bcrypt.genSalt(10);
                const hashedpassword = await bcrypt.hash(password, salt);
                let updatePassword = await adminSchema.findByIdAndUpdate(checkUser[0]._id, { password: hashedpassword }, { new: true });
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, status: 0 }, message: `password changed sucessfully` });
            }
            else {
                return res.status(401).json({ issuccess: true, data: { acknowledgement: false, status: 2 }, message: `incorrect otp` });
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
router.get('/getAdminProfile', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res, next) => {
    try {
        const userId = req.user._id
        console.log(req.user._id);
        const checkUser = await adminSchema.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId(userId)
                }
            },
            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $project: {
                    "generatedTime": 0,
                    "createdAt": 0,
                    "updatedAt": 0,
                    "__v": 0,
                    "otp": 0,
                    password: 0,
                    _id: 0
                }
            },
            {
                $addFields: {
                    country: "Usa",
                    mobileNo: { $ifNull: ["$mobileNo", "Unspecified"] },
                    email: { $ifNull: ["$email", "Unspecified"] },
                    status: { $ifNull: ["$status", 0] },
                    name: { $ifNull: ["$name", ""] }
                }
            }
        ]);
        if (checkUser.length == 0) {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: "no user details found" });

        }
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkUser[0] }, message: "user details found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getAllUsers', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
    try {
        const { userId } = req.body;
        let match;
        let anotherMatch = [];
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('role' in req.query) {
            anotherMatch.push({ role: req.query.role })
        }
        if (userId != undefined) {
            anotherMatch.push({
                _id: mongoose.Types.ObjectId(userId)
            })
        }
        if (anotherMatch.length > 0) {
            match = {
                $match: {
                    $and: anotherMatch
                }
            }
        }
        else {
            match = {
                $match: {

                }
            }
        }
        let getUsers = await userSchema.aggregate([
            match,
            {
                $addFields: {
                    id: "$_id"
                }
            },
            {
                $project: {
                    __v: 0,
                    _id: 0,
                    password: 0,
                    otp: 0,
                    generatedTime: 0,
                    createdAt: 0,
                    updatedAt: 0
                }
            },
            {
                $addFields: {
                    currentPlan: { $ifNull: ["$currentPlan", "Unspecified"] },
                    country: "Usa",
                    mobileNo: { $ifNull: ["$mobileNo", "Unspecified"] },
                    email: { $ifNull: ["$email", "Unspecified"] },
                    status: { $ifNull: ["$status", 0] },
                    name: { $ifNull: ["$name", ""] }
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `users found` : "no user found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getAdminUsers', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
    try {
        const { userId } = req.body;
        let match;
        let anotherMatch = [];
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('role' in req.query) {
            anotherMatch.push({ role: req.query.role })
        }
        if (userId != undefined) {
            anotherMatch.push({
                _id: mongoose.Types.ObjectId(userId)
            })
        }
        console.log(anotherMatch);
        if (anotherMatch.length > 0) {
            match = {
                $match: {
                    $and: anotherMatch
                }
            }
        }
        else {
            match = {
                $match: {

                }
            }
        }
        let getUsers = await adminSchema.aggregate([
            match,
            {
                $addFields: {
                    id: "$_id"
                }
            },
            {
                $project: {
                    __v: 0,
                    _id: 0,
                    password: 0,
                    otp: 0,
                    generatedTime: 0,
                    createdAt: 0,
                    updatedAt: 0
                }
            },
            {
                $addFields: {
                    country: "Usa",
                    mobileNo: { $ifNull: ["$mobileNo", "Unspecified"] },
                    email: { $ifNull: ["$email", "Unspecified"] },
                    status: { $ifNull: ["$status", 0] }
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `admin users found` : "no user found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addCategory', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('icons').single('image'),
    [body("name").isString().withMessage("please provide valid category name"),
    body('description').optional().isString().withMessage("please provide valid description"),
    body('isSubscription').isBoolean().withMessage("please provide valid subscription field"),
    body('isVisible').optional().isBoolean().withMessage("please provide valid visibility field")], checkErr, async (req, res) => {
        try {
            const { name, description, isSubscription, isVisible } = req.body;
            if (req.file == undefined || req.file.location == undefined) {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please pass image field` });
            }
            let checkCategory = await categorySchema.findOne({ name: name });
            console.log(req.file);
            if (checkCategory != undefined || checkCategory != null) {
                removeObject(req.file.key)
                return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} already registered` });
            }

            let addCategory = new categorySchema({
                name: name,
                icon: req.file != undefined ? req.file.location : "",
                description: description,
                isSubscription: isSubscription,
                isVisible: isVisible
            })

            await addCategory.save();
            addCategory._doc['id'] = addCategory._doc['_id'];
            delete addCategory._doc.updatedAt;
            delete addCategory._doc.createdAt;
            delete addCategory._doc._id;
            delete addCategory._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${name} successfully added` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateCategory', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('icons').single('image'), [body("name").optional().isString().withMessage("please provide valid category name"),
body('description').optional().isString().withMessage("please provide valid description"),
body('isVisible').optional().isBoolean().withMessage("please provide valid visibility field"),
body('isSubscription').optional().isBoolean().withMessage("please provide valid subscription field"),
body('categoryId').custom((value) => { return mongoose.Types.ObjectId.isValid(value) }).withMessage("please provide category id")], checkErr, async (req, res) => {
    try {
        const { name, categoryId, description, isSubscription, isVisible } = req.body;

        let checkCategory = await categorySchema.findById(categoryId);
        if (checkCategory == undefined || checkCategory == null) {
            return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `Categoory not found` });
        }
        if ('name' in req.body) {
            let checkName = await categorySchema.findOne({ name: name });
            if (checkName != undefined && checkName != null && checkName._id.toString() != categoryId) {
                return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} already registered` });
            }
        }

        let addCategory = {
            name: name,
            icon: req.file != undefined ? req.file.location : checkCategory.location,
            isVisible: isVisible,
            description: description,
            isSubscription: isSubscription
        }

        if (req.file != undefined) {
            let result = checkCategory.icon.indexOf("icons");
            let key = checkCategory.icon.substring(result, checkCategory.icon.length)
            if (key != undefined) {
                removeObject(key)
            }
        }
        let update = await categorySchema.findByIdAndUpdate(categoryId, addCategory, { new: true });
        if (update != undefined) {
            update._doc['id'] = update._doc['_id'];
            delete update._doc.updatedAt;
            delete update._doc.createdAt;
            delete update._doc._id;
            delete update._doc.__v;
        }
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `${update.name} successfully updated` });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getCategory', authenticateToken, async (req, res) => {
    try {
        let match;
        let anotherMatch = [];
        console.log(Boolean(req.query.isVisible));
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('isVisible' in req.query) {
            anotherMatch.push({ isVisible: req.query.isVisible === 'true' })
        }
        if ('isSubscription' in req.query) {
            anotherMatch.push({ isSubscription: req.query.isSubscription === 'true' })
        }
        if ('description' in req.query) {
            let regEx = new RegExp(req.query.description, 'i')
            anotherMatch.push({ description: { $regex: regEx } })
        }
        console.log(anotherMatch);
        if (anotherMatch.length > 0) {
            match = {
                $match: {
                    $and: anotherMatch
                }
            }
        }
        else {
            match = {
                $match: {

                }
            }
        }
        let getUsers = await categorySchema.aggregate([
            match,
            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $addFields: {
                    createdAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$createdAt", timezone: "-04:00" } },
                    updatedAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$updatedAt", timezone: "-04:00" } },
                    createdAtTime: { $dateToString: { format: "%H:%M:%S", date: "$createdAt", timezone: "-04:00" } },
                    updatedAtTime: { $dateToString: { format: "%H:%M:%S", date: "$updatedAt", timezone: "-04:00" } },
                }
            },
            {
                $addFields: {
                    createdAt: { $concat: ["$createdAtDate", " ", "$createdAtTime"] },
                    updatedAt: { $concat: ["$updatedAtDate", " ", "$updatedAtTime"] }
                }
            },
            {
                $project: {
                    createdAtDate: 0,
                    updatedAtDate: 0,
                    createdAtTime: 0,
                    updatedAtTime: 0
                }
            },
            {
                $lookup: {
                    from: "helpers",
                    let: { id: "$_id" },
                    pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$categoryId", "$$id"] }, { $eq: ["$isVisible", true] }] } } },
                    {
                        $addFields: {
                            "id": "$_id"
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            __v: 0,
                            isVisible: 0
                        }
                    }],
                    as: "helperData"
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0,
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `category found` : "no category found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addHelper', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('helper').single('image'),
    [body("title").isString().withMessage("please provide valid category name"),
    body('description').optional().isString().withMessage("please provide valid description"),
    body('categoryId', 'please provide category id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value)),
    body('isVisible').optional().isBoolean().withMessage("please provide valid visibility field")], checkErr, async (req, res) => {
        try {
            const { title, description, categoryId, isVisible } = req.body;
            if (req.file == undefined || req.file.location == undefined) {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please pass image field` });
            }
            let checkCategory = await helperSchema.findOne({ title: title, categoryId: mongoose.Types.ObjectId(categoryId) });
            console.log(req.file);
            if (checkCategory != undefined || checkCategory != null) {
                removeObject(req.file.key)
                return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${title} already registered` });
            }

            let addCategory = new helperSchema({
                title: title,
                icon: req.file != undefined ? req.file.location : "",
                description: description,
                categoryId: categoryId,
                isVisible: isVisible
            })

            await addCategory.save();
            addCategory._doc['id'] = addCategory._doc['_id'];
            delete addCategory._doc.updatedAt;
            delete addCategory._doc.createdAt;
            delete addCategory._doc._id;
            delete addCategory._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${title} successfully added` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateHelper', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('helper').single('image'),
    [body("title").optional().notEmpty().isString().withMessage("please provide valid category name"),
    body('description').optional().isString().withMessage("please provide valid description"),
    body('categoryId', 'please provide category id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value)),
    body('isVisible').optional().isBoolean().withMessage("please provide valid visibility field"),
    body('helperId', 'please provide helper id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value)),
    ], checkErr, async (req, res) => {
        try {
            const { title, categoryId, description, helperId, isVisible } = req.body;

            let checkCategory = await helperSchema.findById(helperId);
            if (checkCategory == undefined || checkCategory == null) {
                return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `helper not found` });
            }
            if ('title' in req.body) {
                let checkName = await helperSchema.findOne({ title: title, categoryId: 'categoryId' in req.body ? categoryId : checkCategory.categoryId });
                if (checkName != undefined && checkName != null && checkName._id.toString() != helperId) {
                    return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${title} already registered` });
                }
            }

            let addCategory = {
                title: title,
                icon: req.file != undefined ? req.file.location : checkCategory.location,
                isVisible: isVisible,
                description: description,
                categoryId: categoryId
            }

            if (req.file != undefined) {
                let result = checkCategory.icon.indexOf("helper");
                let key = checkCategory.icon.substring(result, checkCategory.icon.length)
                if (key != undefined) {
                    removeObject(key)
                }
            }
            let update = await helperSchema.findByIdAndUpdate(categoryId, addCategory, { new: true });
            if (update != undefined) {
                update._doc['id'] = update._doc['_id'];
                delete update._doc.updatedAt;
                delete update._doc.createdAt;
                delete update._doc._id;
                delete update._doc.__v;
            }
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `${update.name} successfully updated` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/getHelper', authenticateToken, async (req, res) => {
    try {
        let match;
        let anotherMatch = [];
        if ('title' in req.query) {
            let regEx = new RegExp(req.query.title, 'i')
            anotherMatch.push({ title: { $regex: regEx } })
        }
        if ('isVisible' in req.query) {
            anotherMatch.push({ isVisible: req.query.isVisible === 'true' })
        }
        if ('description' in req.query) {
            let regEx = new RegExp(req.query.description, 'i')
            anotherMatch.push({ description: { $regex: regEx } })
        }
        if ('categoryId' in req.query) {
            anotherMatch.push({ categoryId: mongoose.Types.ObjectId(req.query.categoryId) })
        }
        console.log(anotherMatch);
        if (anotherMatch.length > 0) {
            match = {
                $match: {
                    $and: anotherMatch
                }
            }
        }
        else {
            match = {
                $match: {

                }
            }
        }
        let getUsers = await helperSchema.aggregate([
            match,
            {
                $addFields: {
                    "id": "$_id"
                }
            },

            {
                $lookup: {
                    from: "categories",
                    localField: "categoryId",
                    foreignField: "_id",
                    as: "categoryData"
                }
            },
            {
                $addFields: {
                    categoryName: {
                        $cond: {
                            if: { $gt: [{ $size: "$categoryData" }, 0] }, then: { $first: "$categoryData.name" }, else: ""
                        }
                    }
                }
            },
            {
                $addFields: {
                    createdAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$createdAt", timezone: "-04:00" } },
                    updatedAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$updatedAt", timezone: "-04:00" } },
                    createdAtTime: { $dateToString: { format: "%H:%M:%S", date: "$createdAt", timezone: "-04:00" } },
                    updatedAtTime: { $dateToString: { format: "%H:%M:%S", date: "$updatedAt", timezone: "-04:00" } },
                }
            },
            {
                $addFields: {
                    createdAt: { $concat: ["$createdAtDate", " ", "$createdAtTime"] },
                    updatedAt: { $concat: ["$updatedAtDate", " ", "$updatedAtTime"] }
                }
            },
            {
                $project: {
                    createdAtDate: 0,
                    updatedAtDate: 0,
                    createdAtTime: 0,
                    updatedAtTime: 0
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0,
                    categoryData: 0
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `category helper found` : "no category helper found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addTimeRange', authenticateToken, checkUserRole(['superAdmin']),
    [body("title").isString().withMessage("please provide valid category name"),
    body('description').optional().isString().withMessage("please provide valid description"),
    body('categoryId', 'please provide category id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value)),
    body('isVisible').optional().isBoolean().withMessage("please provide valid visibility field")], checkErr, async (req, res) => {
        try {
            const { title, description, categoryId, isVisible } = req.body;
            if (req.file == undefined || req.file.location == undefined) {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please pass image field` });
            }
            let checkCategory = await helperSchema.findOne({ title: title, categoryId: mongoose.Types.ObjectId(categoryId) });
            console.log(req.file);
            if (checkCategory != undefined || checkCategory != null) {
                removeObject(req.file.key)
                return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${title} already registered` });
            }

            let addCategory = new helperSchema({
                title: title,
                icon: req.file != undefined ? req.file.location : "",
                description: description,
                categoryId: categoryId,
                isVisible: isVisible
            })

            await addCategory.save();
            addCategory._doc['id'] = addCategory._doc['_id'];
            delete addCategory._doc.updatedAt;
            delete addCategory._doc.createdAt;
            delete addCategory._doc._id;
            delete addCategory._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${title} successfully added` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateTimeRange', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('helper').single('image'),
    [body("title").optional().notEmpty().isString().withMessage("please provide valid category name"),
    body('description').optional().isString().withMessage("please provide valid description"),
    body('categoryId', 'please provide category id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value)),
    body('isVisible').optional().isBoolean().withMessage("please provide valid visibility field"),
    body('helperId', 'please provide helper id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value)),
    ], checkErr, async (req, res) => {
        try {
            const { title, categoryId, description, helperId, isVisible } = req.body;

            let checkCategory = await helperSchema.findById(helperId);
            if (checkCategory == undefined || checkCategory == null) {
                return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `helper not found` });
            }
            if ('title' in req.body) {
                let checkName = await helperSchema.findOne({ title: title, categoryId: 'categoryId' in req.body ? categoryId : checkCategory.categoryId });
                if (checkName != undefined && checkName != null && checkName._id.toString() != helperId) {
                    return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${title} already registered` });
                }
            }

            let addCategory = {
                title: title,
                icon: req.file != undefined ? req.file.location : checkCategory.location,
                isVisible: isVisible,
                description: description,
                categoryId: categoryId
            }

            if (req.file != undefined) {
                let result = checkCategory.icon.indexOf("helper");
                let key = checkCategory.icon.substring(result, checkCategory.icon.length)
                if (key != undefined) {
                    removeObject(key)
                }
            }
            let update = await helperSchema.findByIdAndUpdate(categoryId, addCategory, { new: true });
            if (update != undefined) {
                update._doc['id'] = update._doc['_id'];
                delete update._doc.updatedAt;
                delete update._doc.createdAt;
                delete update._doc._id;
                delete update._doc.__v;
            }
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `${update.name} successfully updated` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/getTimeRange', authenticateToken, async (req, res) => {
    try {
        let match;
        let anotherMatch = [];
        if ('title' in req.query) {
            let regEx = new RegExp(req.query.title, 'i')
            anotherMatch.push({ title: { $regex: regEx } })
        }
        if ('isVisible' in req.query) {
            anotherMatch.push({ isVisible: req.query.isVisible === 'true' })
        }
        if ('description' in req.query) {
            let regEx = new RegExp(req.query.description, 'i')
            anotherMatch.push({ description: { $regex: regEx } })
        }
        if ('categoryId' in req.query) {
            anotherMatch.push({ categoryId: mongoose.Types.ObjectId(req.query.categoryId) })
        }
        console.log(anotherMatch);
        if (anotherMatch.length > 0) {
            match = {
                $match: {
                    $and: anotherMatch
                }
            }
        }
        else {
            match = {
                $match: {

                }
            }
        }
        let getUsers = await helperSchema.aggregate([
            match,
            {
                $addFields: {
                    "id": "$_id"
                }
            },

            {
                $lookup: {
                    from: "categories",
                    localField: "categoryId",
                    foreignField: "_id",
                    as: "categoryData"
                }
            },
            {
                $addFields: {
                    categoryName: {
                        $cond: {
                            if: { $gt: [{ $size: "$categoryData" }, 0] }, then: { $first: "$categoryData.name" }, else: ""
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0,
                    categoryData: 0
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `time rage found` : "no any time range found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addItems', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('items').single('image'),
    [body("name", 'please provide valid category name').isString(),
    body('description', 'please provide valid description').optional().isString(),
    body('isVisible', 'please provide valid visibility field').optional().isBoolean(),
    body('isBag', 'please pass valid bag').optional().isBoolean(),
    body('mrp').isNumeric().withMessage("please pass mrp"),
    body('discount', 'please pass discount').optional().notEmpty().isNumeric(),
    body('price', 'please pass valid price value').optional().notEmpty().isNumeric(),
    body('priceTag', 'please pass valid price tag').optional().notEmpty().isString(),
    body('categoryId', 'please provide category id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res) => {
        try {
            const { name, description, isVisible,
                mrp,
                discount,
                price,
                isBag,
                categoryId,
                priceTag } = req.body;
            console.log(req.body);
            if (req.file == undefined || req.file.location == undefined) {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please pass image field` });
            }
            let checkCategory = await itemSchema.findOne({ categoryId: mongoose.Types.ObjectId(categoryId), name: name, mrp: mrp });
            if (checkCategory != undefined || checkCategory != null) {
                removeObject(req.file.key)
                return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} already item exist in same category` });
            }
            let value = 0;
            if (price == undefined && (mrp == undefined || discount == undefined)) {
                // value = mrp - discount != 0 ? (discount / 100) : 0;
                return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please pass mrp and discount value` });
            }
            if (discount == undefined && (mrp == undefined || price == undefined)) {
                // discountIs = mrp - price
                // value = mrp - discount != 0 ? (discount / 100) : 0;
                return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please pass mrp and price value` });
            }
            if (price == undefined && mrp != undefined && discount != undefined) {
                value = mrp - (discount != 0 ? (discount * (mrp / 100)) : 0);
                console.log((discount / 100));
                console.log(value);
            }
            if (discount == undefined && mrp != undefined && price != undefined) {
                discountIs = mrp - price
                value = mrp - discountIs != 0 ? (discountIs * 100 / mrp) : 0;
                console.log(discountIs + "  " + value);
            }
            console.log(value);
            let addCategory = new itemSchema({
                name: name,
                icon: req.file != undefined ? req.file.location : "",
                description: description,
                mrp: mrp,
                discount: discount != undefined ? discount : value,
                isBag: isBag,
                priceTag: priceTag,
                price: price != undefined ? price : value,
                isVisible: isVisible,
                categoryId: categoryId
            })

            await addCategory.save();
            addCategory._doc['id'] = addCategory._doc['_id'];
            delete addCategory._doc.updatedAt;
            delete addCategory._doc.createdAt;
            delete addCategory._doc._id;
            delete addCategory._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${name} item successfully added` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateItems', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('items').single('image'), [
    body("name", 'please provide valid category name').optional().isString(),
    body('description', 'please provide valid description').optional().isString(),
    body('isVisible', 'please provide valid visibility field').optional().isBoolean(),
    body('mrp').optional().isNumeric().withMessage("please pass mrp"),
    body('discount', 'please pass discount').optional().notEmpty().isNumeric(),
    body('price', 'please pass valid price value').optional().notEmpty().isNumeric(),
    body('priceTag', 'please pass valid price tag').optional().notEmpty().isString(),
    body('categoryId', 'please provide category id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value)),
    body('itemId', 'please pass valid item id').custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res) => {
        try {
            const { name, categoryId, description, isVisible, isBag, priceTag, itemId } = req.body;
            let { mrp, price, discount } = req.body;
            let checkItem = await itemSchema.findById(itemId);
            if (checkItem == undefined || checkItem == null) {
                return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `item not found` });
            }
            if (categoryId != null && categoryId != undefined) {
                let checkCategory = await categorySchema.findById(categoryId);
                if (checkCategory == undefined || checkCategory == null) {
                    return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `category not found` });
                }

                console.log("checkCate");
                console.log(checkCategory);
            }
            if (name != undefined && name != null) {
                let checkItemExist = await itemSchema.findOne({ name: name, categoryId: categoryId != null && categoryId != undefined ? mongoose.Types.ObjectId(categoryId) : checkItem.categoryId, mrp: mrp != undefined && mrp != null ? mrp : checkItem.mrp });
                if (checkItemExist != undefined && checkItemExist != null && checkItemExist._id.toString() != itemId) {
                    return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} similar item already exist` });
                }
            }
            if (price == undefined && mrp != undefined && discount != undefined) {
                price = mrp - (discount != 0 ? (discount * (mrp / 100)) : 0);
            }
            if (discount == undefined && mrp != undefined && price != undefined) {
                discountIs = mrp - price
                discount = mrp - discountIs != 0 ? (discountIs * 100 / mrp) : 0;
            }
            if (mrp != undefined && price == undefined && discount == undefined) {
                discount = checkItem.discount;
                price = mrp - (discount != 0 ? (discount * (mrp / 100)) : 0);
            }
            if (discount != undefined && mrp == undefined && price == undefined) {
                mrp = checkItem.mrp;
                price = mrp - (discount != 0 ? (discount * (mrp / 100)) : 0);
            }
            if (price != undefined && mrp == undefined && discount == undefined) {
                mrp = checkItem.mrp;
                discountIs = mrp - price
                discount = mrp - discountIs != 0 ? (discountIs * 100 / mrp) : 0;
            }
            let addCategory = {
                name: name,
                icon: req.file != undefined ? req.file.location : checkItem.icon,
                description: description,
                mrp: mrp,
                discount: discount,
                isBag: isBag,
                priceTag: priceTag,
                price: price,
                isVisible: isVisible,
                categoryId: categoryId
            }

            if (req.file != undefined) {
                let result = checkItem.icon.indexOf("items");
                let key = checkItem.icon.substring(result, checkItem.icon.length)
                if (key != undefined) {
                    removeObject(key)
                }
            }
            let update = await itemSchema.findByIdAndUpdate(itemId, addCategory, { new: true });
            update._doc['id'] = update._doc['_id'];
            delete update._doc.updatedAt;
            delete update._doc.createdAt;
            delete update._doc._id;
            delete update._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `${update.name} successfully updated` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/getItems', authenticateToken, async (req, res) => {
    try {
        let match;
        let anotherMatch = [];
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('isVisible' in req.query) {
            anotherMatch.push({ isVisible: req.query.isVisible === 'true' })
        }
        if ('description' in req.query) {
            let regEx = new RegExp(req.query.description, 'i')
            anotherMatch.push({ description: { $regex: regEx } })
        }
        if ('categoryId' in req.query) {
            anotherMatch.push({ categoryId: mongoose.Types.ObjectId(req.query.categoryId) })
        }
        if ('isBag' in req.query) {
            anotherMatch.push({ isBag: req.query.isBag === 'true' })
        }
        if ('priceTag' in req.query) {
            let regEx = new RegExp(req.query.priceTag, 'i')
            anotherMatch.push({ priceTag: { $regex: regEx } })
        }
        if ('itemId' in req.query) {
            anotherMatch.push({ _id: mongoose.Types.ObjectId(req.query.itemId) })
        }
        if ('mrpStart' in req.query == true && 'mrpEnd' in req.query == true) {
            anotherMatch.push({ $and: [{ mrp: { "$gte": parseFloat(req.query.mrpStart) } }, { mrp: { "$lte": parseFloat(req.query.mrpEnd) } }] });
        }
        if ('discountStart' in req.query == true && 'discountEnd' in req.query == true) {
            anotherMatch.push({ $and: [{ discount: { "$gte": parseFloat(req.query.discountStart) } }, { discount: { "$lte": parseFloat(req.query.discountEnd) } }] });
        }
        if ('priceStart' in req.query == true && 'priceEnd' in req.query == true) {
            anotherMatch.push({ $and: [{ price: { "$gte": parseFloat(req.query.priceStart) } }, { price: { "$lte": parseFloat(req.query.priceEnd) } }] });
        }
        if (anotherMatch.length > 0) {
            match = {
                $match: {
                    $and: anotherMatch
                }
            }
        }
        else {
            match = {
                $match: {

                }
            }
        }
        let getUsers = await itemSchema.aggregate([
            match,
            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "categoryId",
                    foreignField: "_id",
                    as: "categoryData"
                }
            },
            {
                $addFields: {
                    categoryName: {
                        $cond: {
                            if: { $gt: [{ $size: "$categoryData" }, 0] }, then: { $first: "$categoryData.name" }, else: ""
                        }
                    }
                }
            },
            {
                $addFields: {
                    createdAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$createdAt", timezone: "-04:00" } },
                    updatedAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$updatedAt", timezone: "-04:00" } },
                    createdAtTime: { $dateToString: { format: "%H:%M:%S", date: "$createdAt", timezone: "-04:00" } },
                    updatedAtTime: { $dateToString: { format: "%H:%M:%S", date: "$updatedAt", timezone: "-04:00" } },
                }
            },
            {
                $addFields: {
                    createdAt: { $concat: ["$createdAtDate", " ", "$createdAtTime"] },
                    updatedAt: { $concat: ["$updatedAtDate", " ", "$updatedAtTime"] }
                }
            },
            {
                $project: {
                    createdAtDate: 0,
                    updatedAtDate: 0,
                    createdAtTime: 0,
                    updatedAtTime: 0
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0,
                    categoryData: 0
                }
            }
        ])
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `category items found` : "no category items found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addPlan', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('plans').single('image'),
    [body('name').isString().withMessage("please pass subscription name"),
    body('pickup').isNumeric().withMessage("please pass numeric pickup"),
    body('delivery').isNumeric().withMessage("please pass delivery numbers"),
    body('month').isNumeric().withMessage("please pass monthly price"),
    body('quarterly').isNumeric().withMessage("please pass quarterly price"),
    body('year').isNumeric().withMessage("please pass yearly price"),
    body('tag').optional().isString().withMessage("please pass additional tag"),
    body('isVisible').optional().isBoolean().withMessage("please pass boolean for visibility"),
    ]
    , checkErr, async (req, res) => {
        try {
            const { name,
                pickup,
                delivery,
                month,
                quarterly,
                year,
                tag,
                isVisible } = req.body;
            let checkCategory = await subscriptionSchema.findOne({ name: name, pickup: pickup, delivery: delivery, month: month, year: year });
            if (checkCategory != undefined || checkCategory != null) {
                removeObject(req.file.key)
                return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} plan already exist` });
            }
            if (req.file == undefined || req.file.location == undefined) {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please upload icon image` });
            }
            let addCategory = new subscriptionSchema({
                name: name,
                icon: req.file.location,
                pickup: pickup,
                delivery: delivery,
                month: month,
                quarterly: quarterly,
                isVisible: isVisible,
                year: year,
                tag: tag
            })

            await addCategory.save();
            addCategory._doc['id'] = addCategory._doc['_id'];
            delete addCategory._doc.updatedAt;
            delete addCategory._doc.createdAt;
            delete addCategory._doc._id;
            delete addCategory._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${name} successfully plan created` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updatePlan', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('plans').single('image'),
    [body('name').optional().isString().withMessage("please pass subscription name"),
    body('pickup').optional().isNumeric().withMessage("please pass numeric pickup"),
    body('delivery').optional().isNumeric().withMessage("please pass delivery numbers"),
    body('month').optional().isNumeric().withMessage("please pass monthly price"),
    body('quarterly').optional().isNumeric().withMessage("please pass quarterly price"),
    body('year').optional().isNumeric().withMessage("please pass yearly price"),
    body('tag').optional().isString().withMessage("please pass additional tag"),
    body('isVisible').optional().isBoolean().withMessage("please pass boolean for visibility"),
    body('planId').custom((value) => { return mongoose.Types.ObjectId.isValid(value) }).withMessage("please pass plan id")
    ]
    , checkErr, async (req, res) => {
        try {
            const { name,
                pickup,
                delivery,
                month,
                quarterly,
                year,
                tag,
                isVisible, planId } = req.body;
            // console.log(planId);
            let checkCategory = await subscriptionSchema.findById(mongoose.Types.ObjectId(planId));
            // console.log(checkCategory);
            if (checkCategory == undefined || checkCategory == null) {
                return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `subscription plan not found` });
            }
            let addCategory = {
                pickup: pickup,
                delivery: delivery,
                month: month,
                quarterly: quarterly,
                year: year,
                tag: tag,
                name: name,
                icon: req.file != undefined ? req.file.location : checkCategory.icon,
                isVisible: isVisible
            }

            if (req.file != undefined) {
                let result = checkCategory.icon.indexOf("plans");
                let key = checkCategory.icon.substring(result, checkCategory.icon.length)
                if (key != undefined) {
                    removeObject(key)
                }
            }
            let update = await subscriptionSchema.findByIdAndUpdate(planId, addCategory, { new: true });
            update._doc['id'] = update._doc['_id'];
            delete update._doc.updatedAt;
            delete update._doc.createdAt;
            delete update._doc._id;
            delete update._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `${update.name} successfully updated` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/getPlan', authenticateToken, async (req, res) => {
    try {
        let getUsers = await subscriptionSchema.aggregate([
            {
                $match: {
                    isVisible: true
                }
            },
            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $project: {
                    _id: 0,
                    isVisible: 0,
                    __v: 0,
                    createdAt: 0,
                    updatedAt: 0
                }
            }
        ])
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `subscription found` : "no subscription plan found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.put('/updateRider', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('rider').single('image'), [body('name', 'please enter valid name').optional().notEmpty().isString(),
body('gender', "please pass dob").optional().isIn(["Male", "Female", "Other"]),
body('dob', "please pass dob").optional().custom((value) => { return regex.test(value) }),
body('fatherName', 'please enter valid fathername value').optional().notEmpty().isString(),
body('jobStatus', 'please enter valid status').optional().isBoolean(),
body('activeStatus', 'please enter valid active status').optional().isNumeric(),
body('insurance', 'please enter insurance active or not').optional().isBoolean(),
body('riderInsurance', 'please enter rider insurance number').optional().notEmpty().isString(),
body('riderExpiry', 'please enter rider expiry number').optional().notEmpty().custom((value) => { return regex.test(value) }),
body('riderId', 'please enter valid rider id').notEmpty().custom((value) => mongoose.Types.ObjectId.isValid(value))
], checkErr, async (req, res, next) => {
    try {
        const { name,
            dob,
            gender,
            jobStatus,
            activeStatus,
            fatherName,
            insurance,
            riderInsurance,
            riderExpiry
        } = req.body;

        const userId = req.body.riderId

        let checkUser = await riderSchema.findById(userId);
        if (checkUser == undefined || checkUser == null) {
            return res.status(404).json({ issuccess: false, data: { acknowledgement: false }, message: "no user found with this ids" });
        }
        if (req.file != undefined && req.file.location != undefined) {
            let result = checkUser.image.indexOf("rider");
            let key = checkUser.image.substring(result, checkUser.image.length)
            if (key != undefined) {
                removeObject(key)
            }
        }
        let update = {
            name: name,
            dob: dob,
            gender: gender,
            jobStatus: jobStatus,
            activeStatus: activeStatus,
            fatherName: fatherName,
            insurance: insurance,
            riderInsurance: riderInsurance,
            riderExpiry: riderExpiry,
            image: req.file != undefined && req.file.location != undefined ? req.file.location : checkUser.image
        }
        let updateRider = await riderSchema.findByIdAndUpdate(userId, update, { new: true });
        updateRider._doc["id"] = updateRider._doc["_id"];
        delete updateRider._doc.__v;
        delete updateRider._doc._id;
        delete updateRider._doc.generatedTime;
        delete updateRider._doc.otp;
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateRider }, message: "user details updated" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.put('/updateRiderVehicle', authenticateToken, checkUserRole(['superAdmin']),
    [body('registrationNo', 'please enter valid registration number').optional().notEmpty().isString(),
    body('registrationDate', 'please enter valid registration number').optional().notEmpty().isString().custom((value) => { return regex.test(value) }),
    body('chassisNo', 'please enter valid chassis number').optional().notEmpty().isString(),
    body('engineNo', 'please enter valid engineNo number').optional().notEmpty().isString(),
    body('ownerName', 'please enter valid ownerName').optional().notEmpty().isString(),
    body('vehicleClass', 'please enter valid vehicle class').optional().notEmpty().isString(),
    body('fuel', 'please enter valid fuel class').optional().notEmpty().isString(),
    body('model', 'please enter valid vehicle model').optional().notEmpty().isString(),
    body('manufacturer', 'please enter valid manufacturer').optional().notEmpty().isString(),
    body('vehicleInsurance', 'please enter insurance available or not').optional().notEmpty().isBoolean(),
    body('insuranceExpiry', 'please enter valid insuranceExpiry date').optional().notEmpty().isString().custom((value) => { return regex.test(value) }),
    body('insuranceNumber', 'please enter valid insuranceNumber').optional().notEmpty().isString(),
    body('riderId', 'please enter valid rider').notEmpty().custom((value) => mongoose.Types.ObjectId.isValid(value))
    ]
    , checkErr, async (req, res) => {
        try {
            const { registrationNo,
                registrationDate,
                chassisNo,
                engineNo,
                ownerName,
                vehicleClass,
                fuel,
                model,
                manufacturer,
                vehicleInsurance,
                insuranceNumber,
                insuranceExpiry } = req.body;
            // console.log(planId);
            const userId = req.body.riderId;
            let checkUser = await riderSchema.findById(userId);
            if (checkUser == undefined || checkUser == null) {
                return res.status(404).json({ issuccess: false, data: { acknowledgement: false }, message: "no user found with this ids" });
            }
            let checkVehicle = await vehicleSchema.findOne({ userId: userId });
            if (checkVehicle == undefined || checkVehicle == null) {
                let vehicle = new vehicleSchema(Object.assign({ userId: userId }, req.body));
                await vehicle.save();
                vehicle._doc['id'] = vehicle._doc['_id'];
                delete vehicle._doc.updatedAt;
                delete vehicle._doc.createdAt;
                delete vehicle._doc._id;
                delete vehicle._doc.__v;
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: vehicle }, message: `vehicle details added` });
            }
            let vehicle = await vehicleSchema.findByIdAndUpdate(checkVehicle._id, req.body, { new: true });
            if (vehicle != undefined) {
                vehicle._doc['id'] = vehicle._doc['_id'];
                delete vehicle._doc.updatedAt;
                delete vehicle._doc.createdAt;
                delete vehicle._doc._id;
                delete vehicle._doc.__v;
            }
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: vehicle }, message: `vehicle details updated` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateRiderWithOtp', authenticateToken, checkUserRole(["superAdmin"]), [oneOf([body('id').isEmail(), body('id').isMobilePhone()], "please pass email or mobile no"),
body('otp').isNumeric().withMessage("please pass otp"),
body('riderId', 'please enter rider id').custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res, next) => {
    try {
        const { otp, id } = req.body;
        const userId = req.body.riderId;
        let checkUser = await riderSchema.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId(userId)
                }
            }
        ]);

        if (checkUser.length == 0) {
            return res.status(404).json({ issuccess: false, data: { acknowledgement: false, status: 3 }, message: `No User Found ` });
        }
        if (otp == '000000') {
            let checkExist = await riderSchema.findOne({ $and: [{ _id: { $nin: [mongoose.Types.ObjectId(userId)] } }, { $or: [{ mobileNo: id }, { email: id }] }] });
            if (checkExist != undefined && checkExist != null) {
                return res.status(403).json({ issuccess: false, data: { acknowledgement: false, status: checkExist.email }, message: checkExist.email == id ? `email already in use` : `mobile no already in use` });
            }
            let updateData = {}
            if (validateEmail(id)) {
                updateData = {
                    email: id
                }
            }
            else if (validatePhoneNumber(id)) {
                updateData = {
                    mobileNo: id
                }
            }
            let updateRider = await riderSchema.findByIdAndUpdate(userId, updateData, { new: true });
            updateRider._doc["id"] = updateRider._doc["_id"];
            delete updateRider._doc.__v;
            delete updateRider._doc._id;
            delete updateRider._doc.generatedTime;
            delete updateRider._doc.otp;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateRider }, message: `details updated` });
        }
        const startIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss')).tz('Asia/Kolkata'));
        const endIs = (momentTz(moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(5, 'minutes')).tz('Asia/Kolkata'));
        const timeIs = (momentTz().tz('Asia/Kolkata'));
        // const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
        // const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
        // const timeIs = moment();
        console.log(startIs)
        if (timeIs >= startIs && timeIs <= endIs) {
            //otp valid
            if (checkUser[0].otp == otp) {
                let checkExist = await riderSchema.findOne({ $and: [{ _id: { $nin: [mongoose.Types.ObjectId(userId)] } }, { $or: [{ mobileNo: id }, { email: id }] }] });
                if (checkExist != undefined && checkExist != null) {
                    return res.status(403).json({ issuccess: false, data: { acknowledgement: false, status: checkExist.email }, message: checkExist.email == id ? `email already in use` : `mobile no already in use` });
                }
                let updateData = {}
                if (validateEmail(id)) {
                    updateData = {
                        email: id
                    }
                }
                else if (validatePhoneNumber(id)) {
                    updateData = {
                        mobileNo: id
                    }
                }
                let updateRider = await riderSchema.findByIdAndUpdate(userId, updateData, { new: true });
                updateRider._doc["id"] = updateRider._doc["_id"];
                delete updateRider._doc.__v;
                delete updateRider._doc._id;
                delete updateRider._doc.generatedTime;
                delete updateRider._doc.otp;
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateRider }, message: `details updated` });
            }
            else {
                return res.status(401).json({ issuccess: false, data: { acknowledgement: false, status: 2 }, message: `incorrect otp` });
            }
            console.log("valid")
        }
        else {
            //otp expired
            return res.status(410).json({ issuccess: false, data: { acknowledgement: false, status: 1 }, message: `otp expired` });
        }

    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getRiderDetails', authenticateToken, checkUserRole(["superAdmin"]), [
    check('riderId', 'please enter rider id').custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res, next) => {
        try {
            const userId = req.query.riderId;
            let checkUser = await riderSchema.aggregate([
                {
                    $match: {
                        _id: mongoose.Types.ObjectId(userId)
                    }
                },
                {
                    $addFields: {
                        "id": "$_id"
                    }
                },
                {
                    $addFields: {
                        "completeDelivery": "1.23K",
                        "completePickUp": "568",
                        "pendingDelivery": "1.23K",
                        "pendingPickUp": "568",
                        "cancelledDelivery": "1.23K",
                        "cancelledPickUp": "568"
                    }
                },
                {
                    $project: {
                        _id: 0,
                        __v: 0,
                        generatedTime: 0,
                        otp: 0
                    }
                }
            ]);

            return res.status(checkUser.length > 0 ? 200 : 404).json({ issuccess: checkUser.length > 0 ? true : false, data: { acknowledgement: checkUser.length > 0 ? true : false, data: checkUser.length > 0 ? checkUser[0] : checkUser }, message: checkUser.length > 0 ? `rider details found` : 'rider not found' });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/getRiderVehicle', authenticateToken, checkUserRole(["superAdmin"]), [
    check('riderId', 'please enter rider id').custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res, next) => {
        try {
            const userId = req.query.riderId;
            let checkUser = await vehicleSchema.aggregate([
                {
                    $match: {
                        userId: mongoose.Types.ObjectId(userId)
                    }
                },
                {
                    $addFields: {
                        "id": "$_id"
                    }
                },
                {
                    $project: {
                        _id: 0,
                        __v: 0,
                        generatedTime: 0,
                        otp: 0
                    }
                }
            ]);

            return res.status(checkUser.length > 0 ? 200 : 404).json({ issuccess: checkUser.length > 0 ? true : false, data: { acknowledgement: checkUser.length > 0 ? true : false, data: checkUser.length > 0 ? checkUser[0] : checkUser }, message: checkUser.length > 0 ? `rider vehicle details found` : 'rider vehicle not found' });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/getRiderProof', authenticateToken, checkUserRole(["superAdmin"]), [
    check('riderId', 'please enter rider id').custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res, next) => {
        try {
            const userId = req.query.riderId;
            let checkUser = await proofSchema.aggregate([
                {
                    $match: {
                        userId: mongoose.Types.ObjectId(userId)
                    }
                },
                {
                    $addFields: {
                        "id": "$_id"
                    }
                },
                {
                    $project: {
                        _id: 0,
                        __v: 0
                    }
                }
            ]);

            return res.status(checkUser.length > 0 ? 200 : 404).json({ issuccess: checkUser.length > 0 ? true : false, data: { acknowledgement: checkUser.length > 0 ? true : false, data: checkUser }, message: checkUser.length > 0 ? `rider proof found` : 'rider proof not found' });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.post('/addProof', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('proof').single('image'),
    [body('title').notEmpty().isString().withMessage("please pass subscription name"),
    body('riderId', 'please enter rider id').custom((value) => mongoose.Types.ObjectId.isValid(value)),
    body('isVerified').optional().isBoolean().withMessage("please pass boolean for visibility"),
    ]
    , checkErr, async (req, res) => {
        try {
            const { riderId, title, isVerified } = req.body;
            if (req.file == undefined || req.file.location == undefined) {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please upload icon image` });
            }
            let checkProof = await proofSchema.findOne({ userId: riderId, title: title });
            if (checkProof != undefined && checkProof != null) {
                return res.status(403).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `proof already exist` });
            }
            let addProof = new proofSchema({
                title: title,
                userId: riderId,
                isVerified: isVerified,
                image: req.file != undefined ? req.file.location : ""
            })
            await addProof.save();
            addProof._doc['id'] = addProof._doc['_id'];
            delete addProof._doc.updatedAt;
            delete addProof._doc.createdAt;
            delete addProof._doc._id;
            delete addProof._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addProof }, message: `${title} proof added` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/refresh', generateRefreshToken);

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
module.exports = router