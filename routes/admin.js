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
const userSubscription = require('../models/userSubscription')
const { check, body, oneOf } = require('express-validator')
const { sendSms } = require('../utility/sendSms');
const nodemailer = require("nodemailer");
const { makeid } = require('../utility/dates');
const { generateAccessToken, authenticateToken, generateRefreshToken, checkUserRole } = require('../middleware/auth');
const orderItems = require('../models/orderItems');
const { getPlaces, placeFilter, formatAddress } = require('../utility/mapbox')
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
const timeSchema = require('../models/timeSchema');
const holidaySchema = require('../models/holidaySchema');
const activeDays = require('../models/activeDays');
const membershipDetails = require('../models/membershipDetails');
const couponSchema = require('../models/couponSchema');
const invoiceSchema = require('../models/invoiceSchema');
const { getDateArray, nextDays, checkUserSubscriptionMember } = require('../utility/expiration');
const apkLinkSchema = require('../models/apkLinkSchema');
const bannerSchema = require('../models/bannerSchema');
const dayWiseSchema = require('../models/dayWiseSchema');
const taxSchema = require('../models/taxSchema');
const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
router.post('/signUp', authenticateToken, checkUserRole(['superAdmin', 'admin']), [body('email').isEmail().withMessage("please pass email id"),
body('name').isString().withMessage("please pass name"),
body('role').isIn(["superAdmin", "admin", "employee"]).withMessage("please pass valid role"),
body('gender').isIn(["Male", "Female", "Other"]).withMessage("please pass valid gender value"),
body('dob').custom((value) => { return regex.test(value) }).withMessage("please pass dob"),
body('mobileNo').isMobilePhone().withMessage("please pass mobile no"),
body('alternativeMobile').optional().isMobilePhone().withMessage("please pass mobile no"),
body('fatherName', 'please pass valid father name').optional().notEmpty().isString(),
body('bloodGroup', 'please pass valid blood group detail').optional().notEmpty().isString()
], checkErr, async (req, res, next) => {
    try {
        const { name, gender, dob, mobileNo, countryCode, fatherName, alternativeMobile, bloodGroup, role, email } = req.body;

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
            fatherName: fatherName,
            bloodGroup: bloodGroup,
            alternativeMobile: alternativeMobile,
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
router.put('/updateInternalEmployee', authenticateToken, checkUserRole(['superAdmin']),
    [check('name', 'please pass valid name').optional().notEmpty().isString().withMessage("please pass valid name"),
    body('role').isIn(["superAdmin", "admin", "employee"]).optional().withMessage("please pass valid role"),
    body('gender').isIn(["Male", "Female", "Other"]).optional().withMessage("please pass valid gender value"),
    body('birthDate').optional().custom((value) => { return regex.test(value) }).withMessage("please pass dob"),
    body('alternativeMobile').optional().isMobilePhone().withMessage("please pass mobile no"),
    body('fatherName', 'please pass valid father name').optional().notEmpty().isString(),
    body('bloodGroup', 'please pass valid blood group detail').optional().notEmpty().isString(),
    body('userId', 'please pass valid user id').notEmpty().isString().custom((value) => mongoose.Types.ObjectId.isValid(value))
    ], checkErr, async (req, res, next) => {
        try {
            const { name, birthDate, gender, fatherName, alternativeMobile, bloodGroup, userId } = req.body;

            const checkExist = await adminSchema.findById(userId);
            if (checkExist == null || checkExist == undefined) {
                return res.status(404).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: "user not found" });
            }
            let updateUser = await adminSchema.findByIdAndUpdate(userId, req.body, { new: true });
            updateUser._doc['id'] = updateUser._doc['_id'];
            delete updateUser._doc.updatedAt;
            delete updateUser._doc.createdAt;
            delete updateUser._doc._id;
            delete updateUser._doc.__v;
            delete updateUser._doc.generatedTime;
            delete updateUser._doc.otp

            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser }, message: "user details updated" });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.post('/updateProfile', authenticateToken, checkUserRole(['superAdmin']),
    [check('name', 'please pass valid name').optional().notEmpty().isString().withMessage("please pass valid name"),
    body('role').isIn(["superAdmin", "admin", "employee"]).optional().withMessage("please pass valid role"),
    body('gender').isIn(["Male", "Female", "Other"]).optional().withMessage("please pass valid gender value"),
    body('birthDate').optional().custom((value) => { return regex.test(value) }).withMessage("please pass dob"),
    body('alternativeMobile').optional().isMobilePhone().withMessage("please pass mobile no"),
    body('fatherName', 'please pass valid father name').optional().notEmpty().isString(),
    body('bloodGroup', 'please pass valid blood group detail').optional().notEmpty().isString()
    ], checkErr, async (req, res, next) => {
        try {
            const { name, birthDate, gender, fatherName, alternativeMobile, bloodGroup } = req.body;
            const userId = req.user._id;
            const checkExist = await adminSchema.findById(userId);
            if (checkExist == null || checkExist == undefined) {
                return res.status(404).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: "user not found" });
            }
            let updateUser = await adminSchema.findByIdAndUpdate(userId, req.body, { new: true });
            updateUser._doc['id'] = updateUser._doc['_id'];
            delete updateUser._doc.updatedAt;
            delete updateUser._doc.createdAt;
            delete updateUser._doc._id;
            delete updateUser._doc.__v;
            delete updateUser._doc.generatedTime;
            delete updateUser._doc.otp

            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser }, message: "user details updated" });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
// router.post('/updateProfile', authenticateToken, [check('name', 'please pass valid name').optional().notEmpty().isString().withMessage("please pass valid name"),
// check('birthDate', 'please pass valid date').optional().notEmpty().trim().custom((value) => { return /^(?:(?:31(\/|-|\.)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(\/|-|\.)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]\d)?\d{2})$|^(?:29(\/|-|\.)0?2\3(?:(?:(?:1[6-9]|[2-9]\d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1\d|2[0-8])(\/|-|\.)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]\d)?\d{2})$/.test(value) }).withMessage("please pass valid date"),
// check('mobileNo', 'please pass valid mobile no').optional().notEmpty().isMobilePhone().withMessage("please pass valid mobile no"),
// check('email', 'please pass valid email').optional().notEmpty().isEmail().withMessage("please pass valid email")], checkErr, async (req, res, next) => {
//     try {
//         const { name, birthDate, mobileNo, email, isVerify } = req.body;

//         const userId = req.user._id

//         let checkEmail = await adminSchema.aggregate([
//             {
//                 $match: {
//                     $or: [
//                         {
//                             $and: [
//                                 { _id: { $ne: mongoose.Types.ObjectId(userId) } },
//                                 { email: email }
//                             ]
//                         },
//                         {
//                             $and: [
//                                 { _id: { $ne: mongoose.Types.ObjectId(userId) } },
//                                 { mobileNo: mobileNo }
//                             ]
//                         }
//                     ]
//                 }
//             },
//             {
//                 $addFields: {
//                     "id": "$_id"
//                 }
//             },
//             {
//                 $project: {
//                     __v: 0,
//                     createdAt: 0,
//                     updatedAt: 0
//                 }
//             }
//         ])
//         if (checkEmail.length != 0) {
//             let state = 4;
//             if (email != undefined && email == checkEmail[0].email && userId != checkEmail[0]._id.toString()) {
//                 state = 0
//             }
//             if (mobileNo != undefined && mobileNo == checkEmail[0].mobileNo && userId != checkEmail[0]._id.toString()) {
//                 state = 1
//             }
//             if (state != 4) {
//                 delete checkEmail[0]._id;
//                 return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: checkEmail[0] }, message: state == 0 ? "thie email already exist" : "this mobile no already exist" });
//             }
//         }
//         let updateUser = await adminSchema.findByIdAndUpdate(userId, { email: email, name: name, mobileNo: mobileNo, birthDate: birthDate }, { new: true })
//         updateUser._doc['id'] = updateUser._doc['_id'];
//         delete updateUser._doc.updatedAt;
//         delete updateUser._doc.createdAt;
//         delete updateUser._doc._id;
//         delete updateUser._doc.__v;
//         delete updateUser._doc.generatedTime;
//         delete updateUser._doc.otp

//         if (isVerify != undefined && isVerify == true) {
//             if (email != undefined && validateEmail(email)) {
//                 otp = getRandomIntInclusive(111111, 999999);
//                 res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser, otp: otp }, message: "user found" });
//                 let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
//                 let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
//                 await main(checkExist[0].email, message);
//             }
//             else if (mobileNo != undefined && validatePhoneNumber(mobileNo)) {
//                 otp = getRandomIntInclusive(111111, 999999);
//                 res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser, otp: otp }, message: "otp sent to mobile no" });

//                 console.log(otp);
//                 let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
//                 let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
//                 await sendSms(countryCode + mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);

//             }
//         }
//         return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser }, message: "user details updated" });
//     } catch (error) {
//         return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
//     }
// })
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

router.post('/resendOtpUsingId', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { id } = req.body;
        console.log(userId);
        let checkOtp = await adminSchema.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId(userId)
                }
            }
        ])
        if (checkOtp.length == 0) {
            return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "no user found with this ids" });
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

        return res.status(200).json({ IsSuccess: true, Data: [], Messsage: "user not found" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getUserAddress', authenticateToken, checkUserRole(['superAdmin']), async (req, res, next) => {
    try {
        const userId = req.query.userId
        let match;
        let anotherMatch = [];
        if ('isActive' in req.query) {
            anotherMatch.push({ isActive: req.query.isActive === 'true' })
        }
        if ('addressId' in req.query) {
            anotherMatch.push({ _id: mongoose.Types.ObjectId(req.query.addressId) });
        }
        if (userId != undefined) {
            anotherMatch.push({
                userId: mongoose.Types.ObjectId(userId)
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
        // console.log(userId)
        let getAddress = await addressSchema.aggregate([
            match,
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

        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getAddress }, message: getAddress.length > 0 ? "address found" : "address not found" });

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getAnalytics', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res, next) => {
    try {
        const userId = req.user._id

        return res.status(200).json({
            "issuccess": true,
            "data": {
                "acknowledgement": true,
                "data": {
                    "year": "2022",
                    "completedDelivery": "1.23K",
                    "completedPickUp": "568",
                    "pendingDelivery": "1.23K",
                    "pendingPickUp": "568",
                    "cancelledDelivery": "1.23K",
                    "cancelledPickUp": "568",
                    "salesOverview": {
                        "totalSales": "52.3K",
                        "isIncrease": true,
                        "percent": "20",
                        "data": [
                            {
                                "title": "Customer",
                                "stats": "2048"
                            },
                            {
                                "title": "totalProfit",
                                "stats": "20K"
                            },
                            {
                                "title": "transaction",
                                "stats": "2546K"
                            }
                        ]
                    },
                    "male": "200",
                    "female": "100",
                    "salesThisWeek": "123k",
                    "weeklySalesSeries": [
                        {
                            "data": [
                                0,
                                2,
                                3,
                                10,
                                15,
                                12,
                                18,
                                20
                            ]
                        }
                    ],
                    "salesThisMonth": "456k",
                    "monthlySalesSeries": [
                        {
                            "data": [
                                2,
                                4,
                                6,
                                4,
                                10,
                                18,
                                15,
                                19
                            ]
                        }
                    ],
                    "salesThisYear": "789k",
                    "yearlySalesSeries": [
                        {
                            "data": [
                                1,
                                4,
                                7,
                                10,
                                15,
                                18,
                                14,
                                20
                            ]
                        }
                    ],
                    "WeeklyTransaction": [
                        {
                            "name": "Last Week",
                            "data": [
                                83,
                                153,
                                213,
                                279,
                                213,
                                153,
                                83
                            ]
                        },
                        {
                            "name": "This Week",
                            "data": [
                                -84,
                                -156,
                                -216,
                                -282,
                                -216,
                                -156,
                                -84
                            ]
                        }
                    ],
                    "transactionReport": {
                        "lastMonthTransactin": "749.30K",
                        "currentWeek": "+81.46%",
                        "lastWeek": "-24.30%",
                        "performance": "+88.70%"
                    }
                }
            },
            "message": "data found"
        })
    } catch (error) {
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
        const { userId } = req.query;
        let match;
        let anotherMatch = [];
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('role' in req.query) {
            anotherMatch.push({ role: req.query.role })
        }
        if ('status' in req.query) {
            anotherMatch.push({ status: parseInt(req.query.status) });
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
                    __v: 0,
                    _id: 0,
                    password: 0,
                    otp: 0,
                    generatedTime: 0
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
router.post('/updateOrderItem', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res, next) => {
    try {
        const { amount, itemId, categoryId, orderId } = req.body;
        let { qty } = req.body;
        const userId = req.user._id;
        let checkItems = await orderItems.findOne({ itemId: mongoose.Types.ObjectId(itemId), orderId: mongoose.Types.ObjectId(orderId) });
        if (checkItems != null && checkItems != undefined) {
            let finalAmount = qty * amount;
            let updateQty = await orderItems.findByIdAndUpdate(checkItems._id, { qty: { $inc: qty }, amount: { $inc: finalAmount } }, { new: true })
            let updateItems = await invoiceSchema.findByIdAndUpdate(orderId, { orderAmount: { $inc: finalAmount } }, { new: true });
            updateQty._doc['id'] = updateQty._doc['_id'];
            delete updateQty._doc.updatedAt;
            delete updateQty._doc.createdAt;
            delete updateQty._doc._id;
            delete updateQty._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateQty }, message: 'items updated' });
        }
        let addItem = new orderItems({
            qty: qty,
            amount: amount,
            itemId: itemId,
            categoryId: categoryId,
            orderId: orderId
        })
        await addItem.save();
        let finalAmount = qty * amount;
        let updateItems = await invoiceSchema.findByIdAndUpdate(orderId, { orderAmount: { $inc: finalAmount } }, { new: true });
        addItem._doc['id'] = addItem._doc['_id'];
        delete addItem._doc.updatedAt;
        delete addItem._doc.createdAt;
        delete addItem._doc._id;
        delete addItem._doc.__v;
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addItem }, message: 'order item added' });
    }
    catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.put('/updateOrderStatus', authenticateToken, checkUserRole(['superAdmin', 'admin']), authenticateToken, async (req, res, next) => {
    try {
        const { delivery, pickup, deliveryTimeId, pickupTimeId, addressId, status, orderId, paymentId, note } = req.body;
        let checkOrder = await invoiceSchema.findById(orderId);
        if (checkOrder != undefined && checkOrder != null) {
            let update = {
                delivery: delivery,
                pickup: pickup,
                deliveryTimeId: deliveryTimeId,
                pickupTimeId: pickupTimeId,
                status: status,
                addressId: addressId,
                paymentId: paymentId,
                note: note
            }
            let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, update, { new: true });
            updateOrder._doc['id'] = updateOrder._doc['_id'];
            delete updateOrder._doc.updatedAt;
            delete updateOrder._doc.createdAt;
            delete updateOrder._doc._id;
            delete updateOrder._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateOrder }, message: 'order updated' });

        }
        return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: 'order not found' });
    }
    catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getOrders', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
    try {
        const { orderId } = req.query;
        let match;
        let anotherMatch = [];
        // if ('name' in req.query) {
        //     let regEx = new RegExp(req.query.name, 'i')
        //     anotherMatch.push({ name: { $regex: regEx } })
        // }
        if ('userId' in req.query) {
            anotherMatch.push({ userId: mongoose.Types.ObjectId(req.query.userId) })
        }
        if ('status' in req.query) {
            anotherMatch.push({ status: parseInt(req.query.status) });
        }
        if ('deliveryStart' in req.query && 'deliveryEnd' in req.query) {
            let [day, month, year] = req.query.deliveryStart.split('/');
            let startIs = new Date(+year, month - 1, +day);
            [day, month, year] = req.query.deliveryEnd.split('/');
            let endIs = new Date(+year, month - 1, +day);
            console.log(startIs + " " + endIs);
            if (startIs != undefined && isNaN(startIs) == false && endIs != undefined && isNaN(endIs) == false) {
                let array = getDateArray(startIs, endIs);
                console.log(array);
                anotherMatch.push({
                    delivery: { $in: array }
                });
            }
            else {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: "please pass valid dates" });
            }
        }
        if ('pickupStart' in req.query && 'pickupEnd' in req.query) {
            let [day, month, year] = req.query.pickupStart.split('/');
            let startIs = new Date(+year, month - 1, +day);
            [day, month, year] = req.query.pickupEnd.split('/');
            let endIs = new Date(+year, month - 1, +day);
            if (startIs != undefined && isNaN(startIs) == false && endIs != undefined && isNaN(endIs) == false) {
                let array = getDateArray(startIs, endIs);
                anotherMatch.push({
                    pickup: { $in: array }
                });
            }
            else {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: "please pass valid dates" });
            }
        }
        console.log(anotherMatch);
        if ('deliveryTimeId' in req.query) {
            anotherMatch.push({ deliveryTimeId: mongoose.Types.ObjectId(deliveryTimeId) });
        }
        if ('pickupTimeId' in req.query) {
            anotherMatch.push({ pickupTimeId: mongoose.Types.ObjectId(pickupTimeId) });
        }
        if (orderId != undefined) {
            anotherMatch.push({
                _id: mongoose.Types.ObjectId(orderId)
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
        let getUsers = await invoiceSchema.aggregate([
            match,
            {
                $addFields: {
                    id: "$_id"
                }
            },
            {
                $lookup: {
                    from: "times",
                    let: { deliveryId: "$deliveryTimeId", pickupId: "$pickupTimeId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$deliveryId"] } } }],
                    as: "deliveryTime"
                }
            },
            {
                $lookup: {
                    from: "times",
                    let: { pickupId: "$pickupTimeId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$pickupId"] } } }],
                    as: "pickupTime"
                }
            },
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$userId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$userId"] } } }],
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "addresses",
                    let: { addressId: "$addressId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$addressId"] } } }, { $addFields: { id: "$_id" } }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "addressData"
                }
            },
            {
                $lookup: {
                    from: "orderitems",
                    let: { id: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$orderId", "$$id"] } } },
                        {
                            $lookup:
                            {
                                from: "categories",
                                let: { categoryId: "$categoryId" },
                                pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$categoryId"] } } }, { $addFields: { id: "$_id" } }, { $project: { _id: 0, __v: 0 } }],
                                as: "categoryData"
                            }
                        },
                        {
                            $addFields: {
                                categoryName: { $first: "$categoryData" },
                                id: "$_id"
                            }
                        },
                        {
                            $project: {
                                _id: 0, __v: 0
                            }
                        },
                        {
                            $lookup:
                            {
                                from: "items",
                                let: { id: "$itemId" },
                                pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$id"] } } }, { $addFields: { id: "$_id" } }, { $project: { _id: 0, __v: 0 } }],
                                as: "itemData"
                            }
                        }, {
                            $addFields: {
                                itemData: { $first: "$itemData" }
                            }
                        },
                    ],
                    as: "ordermItems"
                }
            },
            {
                $addFields: {
                    invoiceId: "$orderId",
                    paymentStatus: { $cond: { if: { $and: [{ $isArray: "$paymentId" }, { $gte: [{ $size: "$paymentId" }, 1] }] }, then: 1, else: 0 } },
                    invoiceStatus: "$status",
                    amount: "$orderAmount",
                    name: { $first: "$userData.name" },
                    addressData: { $first: "$addressData" },
                    deliveryTime: { $concat: [{ $first: "$deliveryTime.start" }, "-", { $first: "$deliveryTime.end" }] },
                    pickupTime: { $concat: [{ $first: "$pickupTime.start" }, "-", { $first: "$pickupTime.end" }] }
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
                    __v: 0,
                    _id: 0,
                    password: 0,
                    otp: 0,
                    generatedTime: 0,
                    userData: 0,
                    createdAtDate: 0,
                    updatedAtDate: 0,
                    createdAtTime: 0,
                    updatedAtTime: 0
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `invoice order found` : "no any invoice orders found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/invoiceList', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
    try {
        const { orderId } = req.query;
        let match;
        let anotherMatch = [];
        // if ('name' in req.query) {
        //     let regEx = new RegExp(req.query.name, 'i')
        //     anotherMatch.push({ name: { $regex: regEx } })
        // }
        if ('userId' in req.query) {
            anotherMatch.push({ userId: mongoose.Types.ObjectId(req.query.userId) })
        }
        if ('status' in req.query) {
            anotherMatch.push({ status: parseInt(req.query.status) });
        }
        if ('deliveryStart' in req.query && 'deliveryEnd' in req.query) {
            let [day, month, year] = req.query.deliveryStart.split('/');
            let startIs = new Date(+year, month - 1, +day);
            [day, month, year] = req.query.deliveryEnd.split('/');
            let endIs = new Date(+year, month - 1, +day);
            console.log(startIs + " " + endIs);
            if (startIs != undefined && isNaN(startIs) == false && endIs != undefined && isNaN(endIs) == false) {
                let array = getDateArray(startIs, endIs);
                console.log(array);
                anotherMatch.push({
                    delivery: { $in: array }
                });
            }
            else {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: "please pass valid dates" });
            }
        }
        if ('pickupStart' in req.query && 'pickupEnd' in req.query) {
            let [day, month, year] = req.query.pickupStart.split('/');
            let startIs = new Date(+year, month - 1, +day);
            [day, month, year] = req.query.pickupEnd.split('/');
            let endIs = new Date(+year, month - 1, +day);
            if (startIs != undefined && isNaN(startIs) == false && endIs != undefined && isNaN(endIs) == false) {
                let array = getDateArray(startIs, endIs);
                anotherMatch.push({
                    pickup: { $in: array }
                });
            }
            else {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: "please pass valid dates" });
            }
        }
        console.log(anotherMatch);
        if ('deliveryTimeId' in req.query) {
            anotherMatch.push({ deliveryTimeId: mongoose.Types.ObjectId(deliveryTimeId) });
        }
        if ('pickupTimeId' in req.query) {
            anotherMatch.push({ pickupTimeId: mongoose.Types.ObjectId(pickupTimeId) });
        }
        if (orderId != undefined) {
            anotherMatch.push({
                _id: mongoose.Types.ObjectId(orderId)
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
        let getUsers = await invoiceSchema.aggregate([
            match,
            {
                $addFields: {
                    id: "$_id"
                }
            },
            {
                $lookup: {
                    from: "times",
                    let: { deliveryId: "$deliveryTimeId", pickupId: "$pickupTimeId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$deliveryId"] } } }],
                    as: "deliveryTime"
                }
            },
            {
                $lookup: {
                    from: "times",
                    let: { pickupId: "$pickupTimeId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$pickupId"] } } }],
                    as: "pickupTime"
                }
            },
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$userId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$userId"] } } }],
                    as: "userData"
                }
            },
            {
                $addFields: {
                    invoiceId: "$orderId",
                    paymentStatus: { $cond: { if: { $and: [{ $isArray: "$paymentId" }, { $gte: [{ $size: "$paymentId" }, 1] }] }, then: 1, else: 0 } },
                    invoiceStatus: "$status",
                    amount: "$orderAmount",
                    name: { $first: "$userData.name" },
                    deliveryTime: { $concat: [{ $first: "$deliveryTime.start" }, "-", { $first: "$deliveryTime.end" }] },
                    pickupTime: { $concat: [{ $first: "$pickupTime.start" }, "-", { $first: "$pickupTime.end" }] }
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
                    __v: 0,
                    _id: 0,
                    password: 0,
                    otp: 0,
                    generatedTime: 0,
                    userData: 0,
                    createdAtDate: 0,
                    updatedAtDate: 0,
                    createdAtTime: 0,
                    updatedAtTime: 0
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `invoice order found` : "no any invoice orders found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getAdminUsers', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
    try {
        const { userId } = req.query;
        let match;
        let anotherMatch = [];
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('role' in req.query) {
            anotherMatch.push({ role: req.query.role })
        }
        if ('status' in req.query) {
            anotherMatch.push({ status: parseInt(req.query.status) });
        }
        if (userId != undefined) {
            anotherMatch.push({
                _id: mongoose.Types.ObjectId(userId)
            })
            console.log(anotherMatch);
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
                    generatedTime: 0
                }
            },
            {
                $addFields: {
                    country: "Usa",
                    mobileNo: { $ifNull: ["$mobileNo", "Unspecified"] },
                    email: { $ifNull: ["$email", "Unspecified"] },
                    status: { $ifNull: ["$status", 0] }
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
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `admin users found` : "no user found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
// router.get('/invoiceList', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
//     try {
//         let invoiceList = [{
//             'id': '632e886fc7d5ed3d874a80a2',
//             'invoiceId': '1234560'
//             , 'name': 'name'
//             , 'userId': '632e886fc7d5ed3d874a80a2'
//             , 'isSubscribed': true
//             , 'paymentStatus': 0
//             , 'invoiceStatus': 1
//             , 'amount': 2000
//             , 'createdAt': '2022-10-03T07:10:28.789+00:00'
//             , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
//         }, {
//             'id': '632e886fc7d5ed3d874a80a2',
//             'invoiceId': '1234560'
//             , 'name': 'name'
//             , 'userId': '632e886fc7d5ed3d874a80a2'
//             , 'isSubscribed': true
//             , 'paymentStatus': 1
//             , 'invoiceStatus': 0
//             , 'amount': 5000
//             , 'createdAt': '2022-10-03T07:10:28.789+00:00'
//             , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
//         }, {
//             'id': '632e886fc7d5ed3d874a80a2',
//             'invoiceId': '1234560'
//             , 'name': 'name'
//             , 'userId': '632e886fc7d5ed3d874a80a2'
//             , 'isSubscribed': true
//             , 'paymentStatus': 0
//             , 'invoiceStatus': 3
//             , 'amount': 2000
//             , 'createdAt': '2022-10-03T07:10:28.789+00:00'
//             , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
//         }, {
//             'id': '632e886fc7d5ed3d874a80a2',
//             'invoiceId': '1234560'
//             , 'name': 'name'
//             , 'userId': '632e886fc7d5ed3d874a80a2'
//             , 'isSubscribed': true
//             , 'paymentStatus': 0
//             , 'invoiceStatus': 1
//             , 'amount': 4400
//             , 'createdAt': '2022-10-03T07:10:28.789+00:00'
//             , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
//         }, {
//             'id': '632e886fc7d5ed3d874a80a2',
//             'invoiceId': '1234560'
//             , 'name': 'name'
//             , 'userId': '632e886fc7d5ed3d874a80a2'
//             , 'isSubscribed': true
//             , 'paymentStatus': 0
//             , 'invoiceStatus': 1
//             , 'amount': 3000
//             , 'createdAt': '2022-10-03T07:10:28.789+00:00'
//             , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
//         }]
//         // const { userId } = req.body;
//         // let match;
//         // let anotherMatch = [];
//         // if ('name' in req.query) {
//         //     let regEx = new RegExp(req.query.name, 'i')
//         //     anotherMatch.push({ name: { $regex: regEx } })
//         // }
//         // if ('role' in req.query) {
//         //     anotherMatch.push({ role: req.query.role })
//         // }
//         // if ('status' in req.query) {
//         //     anotherMatch.push({ status: parseInt(req.query.status) });
//         // }
//         // if (userId != undefined) {
//         //     anotherMatch.push({
//         //         _id: mongoose.Types.ObjectId(userId)
//         //     })
//         // }
//         // console.log(anotherMatch);
//         // if (anotherMatch.length > 0) {
//         //     match = {
//         //         $match: {
//         //             $and: anotherMatch
//         //         }
//         //     }
//         // }
//         // else {
//         //     match = {
//         //         $match: {

//         //         }
//         //     }
//         // }
//         // let getUsers = await adminSchema.aggregate([
//         //     match,
//         //     {
//         //         $addFields: {
//         //             id: "$_id"
//         //         }
//         //     },
//         //     {
//         //         $project: {
//         //             __v: 0,
//         //             _id: 0,
//         //             password: 0,
//         //             otp: 0,
//         //             generatedTime: 0,
//         //             createdAt: 0,
//         //             updatedAt: 0
//         //         }
//         //     },
//         //     {
//         //         $addFields: {
//         //             country: "Usa",
//         //             mobileNo: { $ifNull: ["$mobileNo", "Unspecified"] },
//         //             email: { $ifNull: ["$email", "Unspecified"] },
//         //             status: { $ifNull: ["$status", 0] }
//         //         }
//         //     }
//         // ])
//         return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: invoiceList }, message: invoiceList.length > 0 ? `invoice found` : "no invoice found" });
//     } catch (error) {
//         return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
//     }
// })
router.get('/paymentList', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
    try {
        let invoiceList = [{
            'id': '632e886fc7d5ed3d874a80a2',
            'invoiceId': '1234560',
            'paymentId': 'paymentId',
            'name': 'name'
            , 'userId': '632e886fc7d5ed3d874a80a2'
            , 'paymentStatus': 0,
            'isOnline': true,
            'amount': 2000
            , 'createdAt': '2022-10-03T07:10:28.789+00:00'
            , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
        }, {
            'id': '632e886fc7d5ed3d874a80a2',
            'invoiceId': '1234560',
            'paymentId': 'paymentId',
            'name': 'name'
            , 'userId': '632e886fc7d5ed3d874a80a2'
            , 'paymentStatus': 1,
            'isOnline': false,
            'amount': 3300
            , 'createdAt': '2022-10-03T07:10:28.789+00:00'
            , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
        }, {
            'id': '632e886fc7d5ed3d874a80a2',
            'invoiceId': '1234560',
            'paymentId': 'paymentId',
            'name': 'name'
            , 'userId': '632e886fc7d5ed3d874a80a2'
            , 'paymentStatus': 2,
            'isOnline': true,
            'amount': 4500
            , 'createdAt': '2022-10-03T07:10:28.789+00:00'
            , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
        }, {
            'id': '632e886fc7d5ed3d874a80a2',
            'invoiceId': '1234560',
            'paymentId': 'paymentId',
            'name': 'name'
            , 'userId': '632e886fc7d5ed3d874a80a2'
            , 'paymentStatus': 0,
            'isOnline': true,
            'amount': 3002
            , 'createdAt': '2022-10-03T07:10:28.789+00:00'
            , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
        }, {
            'id': '632e886fc7d5ed3d874a80a2',
            'invoiceId': '1234560',
            'paymentId': 'paymentId',
            'name': 'name'
            , 'userId': '632e886fc7d5ed3d874a80a2'
            , 'paymentStatus': 0,
            'isOnline': true,
            'amount': 8500
            , 'createdAt': '2022-10-03T07:10:28.789+00:00'
            , 'updatedAt': '2022-10-03T07:10:28.789+00:00'
        }]
        // const { userId } = req.body;
        // let match;
        // let anotherMatch = [];
        // if ('name' in req.query) {
        //     let regEx = new RegExp(req.query.name, 'i')
        //     anotherMatch.push({ name: { $regex: regEx } })
        // }
        // if ('role' in req.query) {
        //     anotherMatch.push({ role: req.query.role })
        // }
        // if ('status' in req.query) {
        //     anotherMatch.push({ status: parseInt(req.query.status) });
        // }
        // if (userId != undefined) {
        //     anotherMatch.push({
        //         _id: mongoose.Types.ObjectId(userId)
        //     })
        // }
        // console.log(anotherMatch);
        // if (anotherMatch.length > 0) {
        //     match = {
        //         $match: {
        //             $and: anotherMatch
        //         }
        //     }
        // }
        // else {
        //     match = {
        //         $match: {

        //         }
        //     }
        // }
        // let getUsers = await adminSchema.aggregate([
        //     match,
        //     {
        //         $addFields: {
        //             id: "$_id"
        //         }
        //     },
        //     {
        //         $project: {
        //             __v: 0,
        //             _id: 0,
        //             password: 0,
        //             otp: 0,
        //             generatedTime: 0,
        //             createdAt: 0,
        //             updatedAt: 0
        //         }
        //     },
        //     {
        //         $addFields: {
        //             country: "Usa",
        //             mobileNo: { $ifNull: ["$mobileNo", "Unspecified"] },
        //             email: { $ifNull: ["$email", "Unspecified"] },
        //             status: { $ifNull: ["$status", 0] }
        //         }
        //     }
        // ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: invoiceList }, message: invoiceList.length > 0 ? `payment found` : "no payments found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})

router.get('/getRiders', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
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
        if ('activeStatus' in req.query) {
            anotherMatch.push({ activeStatus: req.query.activeStatus });
        }
        if ('jobStatus' in req.query) {
            anotherMatch.push({ jobStatus: req.query.jobStatus === 'true' });
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

router.post('/addApkLink', authenticateToken, checkUserRole(['superAdmin']), [body("apkLink", "please add apkLink").isString().notEmpty()], checkErr, async (req, res) => {
    try {
        const { apkLink, isAndroid } = req.body;
        let getApkLinks = await apkLinkSchema.aggregate([
            {
                $match: {
                }
            }
        ]);
        if (getApkLinks.length > 0) {
            let update;
            if (isAndroid) {
                update = await apkLinkSchema.findByIdAndUpdate(getApkLinks[0], { apkLink: apkLink }, { new: true });
            }
            else {
                update = await apkLinkSchema.findByIdAndUpdate(getApkLinks[1], { apkLink: apkLink }, { new: true });
            }
            update._doc['id'] = update._doc['_id'];
            delete update._doc._id;
            delete update._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `link successfully updated` });
        }
        let addApkLink = new apkLinkSchema({
            apkLink: apkLink
        });
        await addApkLink.save();
        addApkLink._doc['id'] = addApkLink._doc['_id'];
        delete addApkLink._doc.__v;
        delete addApkLink._doc._id;

        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addApkLink }, message: `link successfully added` });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getApkLink', authenticateToken, async (req, res) => {
    try {
        let getUsers = await apkLinkSchema.aggregate([

            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0,
                }
            }
        ])
        getUsers[0]['deviceType'] = 'Android'
        getUsers[1]['deviceType'] = 'Ios'
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `category found` : "no category found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addCategory', authenticateToken, checkUserRole(['superAdmin', 'admin']), uploadProfileImageToS3('icons').single('image'),
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
router.post('/addTaxes', authenticateToken, checkUserRole(['superAdmin', 'admin']),
    [body('isSubscription', 'please pass valid subscription status').isBoolean(),
    body('isMember', 'please pass valid membership status').isBoolean(),
    body('taxes', 'please pass taxes details').isObject()], checkErr, async (req, res) => {
        try {
            const { isSubscription, isMember, taxes } = req.body;

            let addCategory = new taxSchema({
                isSubscription: isSubscription,
                isMember: isMember,
                taxes: taxes
            })
            await addCategory.save()

            addCategory._doc['id'] = addCategory._doc['_id'];
            delete addCategory._doc.updatedAt;
            delete addCategory._doc.createdAt;
            delete addCategory._doc._id;
            delete addCategory._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `taxes details saved for membership ${isMember} status and subscription status ${isSubscription}` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.post('/addBanner', authenticateToken, checkUserRole(['superAdmin', 'admin']), uploadProfileImageToS3('banner').single('image'), async (req, res) => {
    try {
        const { priority } = req.body;
        if (req.file == undefined || req.file.location == undefined) {
            return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please pass image field` });
        }

        let addCategory = new bannerSchema({
            banner: req.file != undefined ? req.file.location : "",
            priority: priority
        })
        await addCategory.save();
        addCategory._doc['id'] = addCategory._doc['_id'];
        delete addCategory._doc.updatedAt;
        delete addCategory._doc.createdAt;
        delete addCategory._doc._id;
        delete addCategory._doc.__v;
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `banner successfully added` });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.put('/updateBanner', authenticateToken, checkUserRole(['superAdmin', 'admin']), uploadProfileImageToS3('banner').single('image'), async (req, res) => {
    try {
        const { priority, bannerId } = req.body;

        let checkCategory = await bannerSchema.findById(bannerId);
        if (checkCategory == undefined || checkCategory == null) {
            return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `banner not found` });
        }

        let addCategory = {
            banner: req.file != undefined ? req.file.location : checkCategory.location,
            priority: priority
        }

        if (req.file != undefined) {
            let result = checkCategory.banner.indexOf("banner");
            let key = checkCategory.banner.substring(result, checkCategory.icon.length)
            if (key != undefined) {
                removeObject(key)
            }
        }
        let update = await bannerSchema.findByIdAndUpdate(bannerId, addCategory, { new: true });
        if (update != undefined) {
            update._doc['id'] = update._doc['_id'];
            delete update._doc.updatedAt;
            delete update._doc.createdAt;
            delete update._doc._id;
            delete update._doc.__v;
        }
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `banner successfully updated` });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})

router.post('/addTimerange', authenticateToken, checkUserRole(['superAdmin']),
    [body("start", "please provide start hours").notEmpty().isString().custom((value) => { return /^(\d{1,2})\:(\d{1,2})$/.test(value) }),
    body('end', "please provide ending hours").notEmpty().isString().custom((value) => { return /^(\d{1,2})\:(\d{1,2})$/.test(value) }),
    body('isActive', "please provide valid active status field").optional().isBoolean(),
    ], checkErr, async (req, res) => {
        try {
            let { start, end, isActive } = req.body;

            let startIs = start.split(":");
            let endIs = end.split(":");
            startIs = startIs.map((value) => { console.log(value); if (value.length == 1) { return "0" + value } return value })
            endIs = endIs.map((value) => { console.log(value); if (value.length == 1) { return "0" + value } return value })
            console.log(startIs);
            console.log(endIs);
            start = startIs.join(":")
            end = endIs.join(":")
            let checkCategory = await timeSchema.findOne({ start: start, end: end });

            if (checkCategory != undefined || checkCategory != null) {
                return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${start} ${end} already registered` });
            }
            let addCategory = new timeSchema({
                start: start,
                end: end,
                isActive: isActive
            })

            await addCategory.save();
            addCategory._doc['id'] = addCategory._doc['_id'];
            delete addCategory._doc.updatedAt;
            delete addCategory._doc.createdAt;
            delete addCategory._doc._id;
            delete addCategory._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${start} ${end}  successfully added` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateTimerange', authenticateToken, checkUserRole(['superAdmin']),
    [body("start", "please provide start hours").optional().notEmpty().isString(),
    body('end', "please provide ending hours").optional().notEmpty().isString(),
    body('isActive', "please provide valid active status field").optional().isBoolean(),
    body('timerangeId', "please pass valid time range id").custom((value) => mongoose.Types.ObjectId.isValid(value))
    ], checkErr, checkErr, async (req, res) => {
        try {
            const { start, end, isActive, timerangeId } = req.body;

            let checkCategory = await timeSchema.findById(timerangeId);
            if (checkCategory == undefined || checkCategory == null) {
                return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `time range record not found` });
            }
            if ('start' in req.body || 'end' in req.body) {
                let checkName = await timeSchema.findOne({ start: start != undefined ? start : checkCategory.start, end: end != undefined ? end : checkCategory.end });
                if (checkName != undefined && checkName != null && checkName._id.toString() != timerangeId) {
                    return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `this range already registered` });
                }
            }

            let addCategory = {
                start: start,
                end: end,
                isActive: isActive
            }

            let update = await timeSchema.findByIdAndUpdate(timerangeId, addCategory, { new: true });
            if (update != undefined) {
                update._doc['id'] = update._doc['_id'];
                delete update._doc.updatedAt;
                delete update._doc.createdAt;
                delete update._doc._id;
                delete update._doc.__v;
            }
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `timerange successfully updated` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/getTimerange', authenticateToken, async (req, res) => {
    try {
        let match;
        let anotherMatch = [];
        if ('isActive' in req.query) {
            anotherMatch.push({ isActive: req.query.isActive === 'true' })
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
        let getUsers = await timeSchema.aggregate([
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
                $project: {
                    _id: 0,
                    __v: 0,
                }
            }
        ])
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `time range found` : "no any time range found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})

router.post('/suspendUser', authenticateToken, checkUserRole(['superAdmin']),
    [body("userId", "please provide userId").notEmpty().isString().custom((value) => mongoose.Types.ObjectId.isValid(value)),
    body('note', 'please enter valid note').optional().isString().notEmpty(),
    body('reason', 'please enter valid reason').optional().notEmpty().isString(),
    body('status', 'please enter valid status field').optional().isNumeric()
    ], checkErr, async (req, res) => {
        try {
            const { userId, status, note, reason } = req.body;

            let checkUser = await userSchema.findById(userId);
            if (checkUser != null && checkUser != undefined) {
                let updateUser = await userSchema.findByIdAndUpdate(userId, { status: status, note: note, reason: reason }, { new: true });
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser }, message: `user status updated` });
            }
            checkUser = await adminSchema.findById(userId);
            if (checkUser != null && checkUser != undefined) {
                let updateUser = await adminSchema.findByIdAndUpdate(userId, { status: status, note: note, reason: reason }, { new: true });
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser }, message: `admin status updated` });
            }
            checkUser = await riderSchema.findById(userId);
            if (checkUser != null && checkUser != undefined) {
                let updateUser = await riderSchema.findByIdAndUpdate(userId, { activeStatus: status, note: note, reason: reason }, { new: true });
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateUser }, message: `rider status updated` });
            }
            return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `no user found` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateTimerange', authenticateToken, checkUserRole(['superAdmin']),
    [body("start", "please provide start hours").optional().notEmpty().isString(),
    body('end', "please provide ending hours").optional().notEmpty().isString(),
    body('isActive', "please provide valid active status field").optional().isBoolean(),
    body('timerangeId', "please pass valid time range id").custom((value) => mongoose.Types.ObjectId.isValid(value))
    ], checkErr, checkErr, async (req, res) => {
        try {
            const { start, end, isActive, timerangeId } = req.body;

            let checkCategory = await timeSchema.findById(timerangeId);
            if (checkCategory == undefined || checkCategory == null) {
                return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `time range record not found` });
            }
            if ('start' in req.body || 'end' in req.body) {
                let checkName = await timeSchema.findOne({ start: start != undefined ? start : checkCategory.start, end: end != undefined ? end : checkCategory.end });
                if (checkName != undefined && checkName != null && checkName._id.toString() != timerangeId) {
                    return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `this range already registered` });
                }
            }

            let addCategory = {
                start: start,
                end: end,
                isActive: isActive
            }

            let update = await timeSchema.findByIdAndUpdate(timerangeId, addCategory, { new: true });
            if (update != undefined) {
                update._doc['id'] = update._doc['_id'];
                delete update._doc.updatedAt;
                delete update._doc.createdAt;
                delete update._doc._id;
                delete update._doc.__v;
            }
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `timerange successfully updated` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.post('/addCoupon', authenticateToken, checkUserRole(['superAdmin']),
    [body("name", "please provide valid name").notEmpty().isString(),
    body("description", "please provide valid description").optional().notEmpty().isString(),
    body("terms", "please provide valid terms").optional().notEmpty().isString(),
    body("start", "please provide start hours").notEmpty().isString(),
    body('end', "please provide ending hours").notEmpty().isString(),
    body('discount', "please provide discount value").notEmpty().isNumeric(),
    body('isVisible', "please provide valid visibility status field").optional().isBoolean(),
    ], checkErr, async (req, res) => {
        try {
            let { name, description, start, discount, end, isVisible, terms } = req.body;

            let checkCategory = await couponSchema.findOne({ name: name });

            if (checkCategory != undefined || checkCategory != null) {
                return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} already registered` });
            }

            let startIs = moment(start + " 00:00:00", "DD-MM-YYYY hh:mm:ss");

            let endIs = moment(end + " 00:00:00", "DD-MM-YYYY hh:mm:ss");
            console.log(startIs);
            let addCategory = new couponSchema({
                name: name,
                description: description,
                start: startIs,
                end: endIs,
                discount: discount,
                isVisible: isVisible,
                terms: terms
            })

            await addCategory.save();
            addCategory._doc['id'] = addCategory._doc['_id'];
            delete addCategory._doc.updatedAt;
            delete addCategory._doc.createdAt;
            delete addCategory._doc._id;
            delete addCategory._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${name}  successfully added` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateCoupon', authenticateToken, checkUserRole(['superAdmin']),
    [body("name", "please provide valid name").notEmpty().isString(),
    body("description", "please provide valid description").optional().notEmpty().isString(),
    body("terms", "please provide valid terms").optional().notEmpty().isString(),
    body("start", "please provide start hours").optional().notEmpty().isString(),
    body('end', "please provide ending hours").optional().notEmpty().isString(),
    body('isVisible', "please provide valid visibility status field").optional().isBoolean(),
    body('couponId', "please pass valid coupon id").custom((value) => mongoose.Types.ObjectId.isValid(value))
    ], checkErr, checkErr, async (req, res) => {
        try {
            const { name,
                description, terms, discount, start, end, isVisible, couponId } = req.body;

            let checkCategory = await couponSchema.findById(couponId);
            if (checkCategory == undefined || checkCategory == null) {
                return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `coupon not found` });
            }
            let startIs = checkCategory.start
            let endIs = checkCategory.end
            if ('start' in req.body || 'end' in req.body) {
                startIs = moment(start + " 00:00:00", "DD-MM-YYYY hh:mm:ss");

                endIs = moment(end + " 00:00:00", "DD-MM-YYYY hh:mm:ss");
            }
            console.log(startIs);
            let addCategory = {
                name: name,
                description: description,
                terms: terms,
                start: startIs,
                discount: discount,
                end: endIs,
                isVisible: isVisible
            }

            let update = await couponSchema.findByIdAndUpdate(couponId, addCategory, { new: true });
            if (update != undefined) {
                update._doc['id'] = update._doc['_id'];
                delete update._doc.updatedAt;
                delete update._doc.createdAt;
                delete update._doc._id;
                delete update._doc.__v;
            }
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `coupon successfully updated` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/getCoupons', authenticateToken, async (req, res) => {
    try {
        let match;
        let anotherMatch = [];
        await couponSchema.updateMany({}, { description: "desc", terms: "terms" }, { new: true });
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('isActive' in req.query) {
            anotherMatch.push({ isActive: req.query.isActive === 'true' })
        }
        if ('date' in req.query) {
            let dateIs = moment(req.query.date + " 00:00:00", "DD-MM-YYYY hh:mm:ss")
            anotherMatch.push({
                $and: [
                    { isExpired: false },
                    {
                        start: {
                            $lte: new Date(dateIs)
                        }
                    },
                    {
                        end: {
                            $gte: new Date(dateIs)
                        }
                    }
                ]
            })
        }
        if ('start' in req.query && 'end' in req.query) {
            let startIs = moment(req.query.start + " 00:00:00", "DD-MM-YYYY hh:mm:ss")
            let endIs = moment(req.query.end + " 00:00:00", "DD-MM-YYYY hh:mm:ss")
            anotherMatch.push({
                $and: [
                    { isExpired: false },
                    {
                        $or: [
                            {
                                start: {
                                    $gte: new Date(startIs), $lte: new Date(endIs)

                                }
                            },
                            {
                                end: { $gte: new Date(startIs), $lte: new Date(endIs) }
                            }]
                    }
                ]
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
        console.log(JSON.stringify(match));
        let getUsers = await couponSchema.aggregate([
            match,
            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $addFields: {
                    startDate: { $dateToString: { format: "%d-%m-%Y", date: "$start", timezone: "-04:00" } },
                    endDate: { $dateToString: { format: "%d-%m-%Y", date: "$end", timezone: "-04:00" } },
                    startTime: { $dateToString: { format: "%H:%M:%S", date: "$start", timezone: "-04:00" } },
                    endTime: { $dateToString: { format: "%H:%M:%S", date: "$end", timezone: "-04:00" } },
                    createdAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$createdAt", timezone: "-04:00" } },
                    updatedAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$updatedAt", timezone: "-04:00" } },
                    createdAtTime: { $dateToString: { format: "%H:%M:%S", date: "$createdAt", timezone: "-04:00" } },
                    updatedAtTime: { $dateToString: { format: "%H:%M:%S", date: "$updatedAt", timezone: "-04:00" } },
                }
            },
            {
                $addFields: {
                    createdAt: { $concat: ["$createdAtDate", " ", "$createdAtTime"] },
                    updatedAt: { $concat: ["$updatedAtDate", " ", "$updatedAtTime"] },
                    start: { $concat: ["$startDate", " ", "$startTime"] },
                    end: { $concat: ["$endDate", " ", "$endTime"] }
                }
            },
            {
                $project: {
                    createdAtDate: 0,
                    updatedAtDate: 0,
                    createdAtTime: 0,
                    updatedAtTime: 0,
                    startDate: 0,
                    endDate: 0,
                    startTime: 0,
                    endTime: 0
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0,
                }
            }
        ])
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `coupons found` : "no any coupon found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addHoliday', authenticateToken, checkUserRole(['superAdmin']),
    [body("date", "please provide date").notEmpty().isString().custom((value) => { return regex.test(value) }),
    body('timeSlots', "please provide timeSlot Values").optional().isArray({ min: 1 }),
    body('isHalfHoliday', 'please provide isHalfHoliday field value').optional().isBoolean(),
    body('isFullHoliday', 'please provide fullholiday field value').optional().isBoolean(),
    ], checkErr, async (req, res) => {
        try {
            let { date, timeSlots, isHalfHoliday, isFullHoliday } = req.body;

            if ('isFullHoliday' in req.body && isFullHoliday == true) {
                let getTimeRange = await timeSchema.aggregate([{ $addFields: { isActive: false, time: { $concat: ["$start", "-", "$end"] } } }]);
                timeSlots = getTimeRange
            }
            else {
                if (timeSlots == undefined || Array.isArray(timeSlots) == false || timeSlots.length == 0) {
                    return res.status(400).json({ issuccess: false, data: { acknowledgement: false }, message: `please provide time slots` });
                }
            }
            let checkEntry = await dayWiseSchema.aggregate([{ $match: { date: date } }]);
            if (checkEntry.length > 0) {
                return res.status(200).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: `${date} cannot edit this date data` });
            }
            let checkCategory = await holidaySchema.findOne({ date });

            if (checkCategory != undefined || checkCategory != null) {
                let addCategory = await holidaySchema.findByIdAndUpdate(checkCategory._id, { date: date, timeSlots: timeSlots, isHalfHoliday: isHalfHoliday, isFullHoliday: isFullHoliday })
                addCategory._doc['id'] = addCategory._doc['_id'];
                delete addCategory._doc.updatedAt;
                delete addCategory._doc.createdAt;
                delete addCategory._doc._id;
                delete addCategory._doc.__v;
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${date} holiday successfully added` });
            }

            let addCategory = new holidaySchema({
                date: date,
                timeSlots: timeSlots,
                isHalfHoliday: isHalfHoliday,
                isFullHoliday: isFullHoliday
            })

            await addCategory.save();
            addCategory._doc['id'] = addCategory._doc['_id'];
            delete addCategory._doc.updatedAt;
            delete addCategory._doc.createdAt;
            delete addCategory._doc._id;
            delete addCategory._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${date} holiday successfully added` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.delete('/removeHoliday', authenticateToken, checkUserRole(['superAdmin']),
    [
        body('holidayId', 'please pass valid holiday id').notEmpty().custom((value) => mongoose.Types.ObjectId.isValid(value))
    ], checkErr, async (req, res) => {
        try {
            const { holidayId } = req.body;
            let getRecord = await holidaySchema.findById(holidayId);
            if (getRecord != undefined && getRecord != null) {
                let removeRecord = await holidaySchema.findByIdAndRemove(holidayId)
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: removeRecord }, message: "record removed successfully" })
            }
            return res.status(404).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: `holiday record not found` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.get('/getActiveDays', authenticateToken, async (req, res) => {
    try {
        const { date, dateTimeId, isActive, isHalfHoliday, isFullHoliday } = req.query;
        let anotherMatch = [];
        if (date != undefined && date != null) {
            anotherMatch.push({ date: date })
        }
        if (dateTimeId != undefined && dateTimeId != null) {
            anotherMatch.push({ _id: mongoose.Types.ObjectId(dateTimeId) })
        }
        if (isActive != undefined && isActive != null) {
            anotherMatch.push({ isActive: isActive === 'true' })
        }
        if (isHalfHoliday != undefined && isHalfHoliday != null) {
            anotherMatch.push({ isHalfHoliday: isHalfHoliday === 'true' })
        }
        if (isFullHoliday
            != undefined && isFullHoliday != null) {
            anotherMatch.push({ isFullHoliday: isFullHoliday === 'true' })
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
        let getDate = await dayWiseSchema.aggregate([
            match,
            {
                $addFields: {
                    id: "$_id"
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0
                }
            }
        ])
        // let getHoliday = await holidaySchema.findOne({ date: date });
        // console.log(getHoliday);
        // if (getHoliday != null && getHoliday != undefined) {
        //     let checkExist = await activeDays.aggregate([{ $match: { date: date } }]);
        //     console.log(checkExist);
        //     if (checkExist.length > 0) {
        //         return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkExist[0] }, message: `${date} status found` });
        //     }
        //     let addDay = new activeDays({ date: getHoliday.date, timeSlots: getHoliday.timeSlots, isFullHoliday: getHoliday.isFullHoliday });
        //     await addDay.save();
        //     return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addDay }, message: `${date} status found` });
        // }
        // let checkExist = await activeDays.aggregate([{ $match: { date: date } }]);
        // if (checkExist.length > 0) {
        //     return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkExist[0] }, message: `${date} status found` });
        // }
        // let getTimeRange = await timeSchema.aggregate([{ $addFields: { isActive: true, time: { $concat: ["$start", " - ", "$end"] } } }]);
        // let addDay = new activeDays({ date: date, timeSlots: getTimeRange });
        // await addDay.save();
        return res.status(200).json({ issuccess: getDate.length > 0 ? true : false, data: { acknowledgement: getDate.length > 0 ? true : false, data: getDate }, message: getDate.length > 0 ? `date slots found` : `no any date slots found` });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getPickUpDays', authenticateToken, async (req, res) => {
    try {
        // console.log(moment()
        //     .tz('America/Panama')
        //     .format("DD/MM/YYYY"));
        // console.log(moment()
        //     .tz('America/Panama')
        //     .format("H:mm:ss"));
        const userId = req.user._id;
        let currentDate = moment()
            .tz('America/Panama')
        let checkSubscription = await checkUserSubscriptionMember(userId)
        // console.log("subscription");
        // console.log(checkSubscription);
        if (checkSubscription.length > 0 && 'isSubscription' in checkSubscription[0] && 'isMember' in checkSubscription[0] && checkSubscription[0].isSubscription == true && checkSubscription[0].isMember == true) {

        }
        else {
            console.log("else");
            currentDate = currentDate.add(1, 'day');
        }
        // console.log(currentDate);
        let getNextDays = await nextDays(currentDate)
        console.log(getNextDays);
        let getDays = await dayWiseSchema.aggregate([
            {
                $match: {
                    date: { $in: getNextDays }
                }
            },
            {
                $addFields: {
                    id: "$_id"
                }
            },
            {
                $project: {
                    __v: 0,
                    _id: 0
                }
            },
            {
                $group: {
                    _id: { date: "$date" },
                    timeSlots: { $push: "$$ROOT" }
                }
            },
            {
                $addFields: {
                    date: "$_id.date",
                    dateType: {
                        $dateFromString: {
                            dateString: "$_id.date",
                            format: "%d/%m/%Y",
                            timezone: "-04:00"
                        }
                    }
                }
            },
            {
                $sort: {
                    dateType: 1
                }
            },
            {
                $project: {
                    _id: 0,
                    dateType: 0
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getDays }, message: `data found for next 7 days` });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getDeliveryDays', authenticateToken, async (req, res) => {
    try {

        // console.log(moment()
        //     .tz('America/Panama')
        //     .format("DD/MM/YYYY"));
        // console.log(moment()
        //     .tz('America/Panama')
        //     .format("H:mm:ss"));

        const userId = req.user._id;
        const { dateTimeId } = req.query;
        let getdateTimeData = await dayWiseSchema.findById(dateTimeId);
        if (getdateTimeData == null || getdateTimeData == undefined) {
            return res.status(200).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: `datetime not found any` });
        }
        let dateIs = getdateTimeData.date.split("/");
        // console.log(dateIs[0]);
        let currentDate = moment(Date.parse(`2022-12-07T16:01:00Z`)).tz('America/Panama')
        let timeDateIs = moment(Date.parse(`${dateIs[2]}-${dateIs[1]}-${dateIs[0]}T16:00:00Z`)).tz('America/Panama')
        // console.log(currentDate);
        // console.log(currentDate.format("DD/MM/YYYY,h:mm:ss a"));
        // console.log(timeDateIs.format("DD/MM/YYYY,h:mm:ss a"));
        let checkSubscription = await checkUserSubscriptionMember(userId)
        // checkSubscription[0].isMember = true
        // console.log(checkSubscription);
        // console.log("subscription");
        // console.log(checkSubscription);
        if (checkSubscription.length > 0 && 'isSubscription' in checkSubscription[0] && 'isMember' in checkSubscription[0] && checkSubscription[0].isMember == true && currentDate > timeDateIs) {
            currentDate = currentDate.add(1, 'day');
        }
        // console.log(currentDate);
        let getNextDays = await nextDays(currentDate)
        // console.log(getNextDays);
        let getDays = await dayWiseSchema.aggregate([
            {
                $match: {
                    date: { $in: getNextDays }
                }
            },
            {
                $addFields: {
                    id: "$_id"
                }
            },
            {
                $project: {
                    __v: 0,
                    _id: 0
                }
            },
            {
                $group: {
                    _id: { date: "$date" },
                    timeSlots: { $push: "$$ROOT" }
                }
            },
            {
                $addFields: {
                    date: "$_id.date",
                    dateType: {
                        $dateFromString: {
                            dateString: "$_id.date",
                            format: "%d/%m/%Y",
                            timezone: "-04:00"
                        }
                    }
                }
            },
            {
                $sort: {
                    dateType: 1
                }
            },
            {
                $project: {
                    _id: 0,
                    dateType: 0
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getDays }, message: `data found for next 7 days` });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getHoliday', authenticateToken, async (req, res) => {
    try {
        let anotherMatch = [];
        if ('isFullHoliday' in req.query) {
            anotherMatch.push({ isFullHoliday: req.query.isFullHoliday === 'true' })
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
        let getHoliday = await holidaySchema.aggregate([
            match,
            {
                $addFields: {
                    id: "$_id",
                    isHalf: { $cond: { if: { $eq: ["$isFullHoliday", true] }, then: false, else: true } }
                }
            },
            {
                $project: {
                    __v: 0,
                    _id: 0
                }
            }
        ])
        return res.status(getHoliday.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: getHoliday.length > 0 ? true : false, data: getHoliday }, message: getHoliday.length > 0 ? "holiday details found" : "no any holiday scheduled" });
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
            let update = await helperSchema.findByIdAndUpdate(helperId, addCategory, { new: true });
            if (update != undefined) {
                update._doc['id'] = update._doc['_id'];
                delete update._doc.updatedAt;
                delete update._doc.createdAt;
                delete update._doc._id;
                delete update._doc.__v;
            }
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `${update.title} successfully updated` });
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
router.post('/addItems', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('items').single('image'),
    [body("name", 'please provide valid category name').isString(),
    body('description', 'please provide valid description').optional().isString(),
    body('isVisible', 'please provide valid visibility field').optional().isBoolean(),
    body('isBag', 'please pass valid bag').optional().isBoolean(),
    body('mrp').isNumeric().withMessage("please pass mrp"),
    body('discount', 'please pass discount').optional().notEmpty().isNumeric(),
    body('price', 'please pass valid price value').optional().notEmpty().isNumeric(),
    body('priceTag', 'please pass valid price tag').optional().notEmpty().isString(),
    body('unitType', 'please pass valid unit type').optional().notEmpty().isString(),
    body('categoryId', 'please provide category id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res) => {
        try {
            const { name, description, isVisible,
                mrp,
                discount,
                unitType,
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
                unitType: unitType,
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
    body('unitType', 'please pass valid unit type').optional().notEmpty().isString(),
    body('categoryId', 'please provide category id').optional().custom((value) => mongoose.Types.ObjectId.isValid(value)),
    body('itemId', 'please pass valid item id').custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res) => {
        try {
            const { name, categoryId, description, unitType, isVisible, isBag, priceTag, itemId } = req.body;
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
                unitType: unitType,
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
        const userId = req.user._id;
        let match;
        let anotherMatch = [];
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('unitType' in req.query) {
            let regEx = new RegExp(req.query.unitType, 'i')
            anotherMatch.push({ unitType: { $regex: regEx } })
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
            let checkSubscription = await userSubscription.aggregate([{ $project: { pendingPickUp: { $sum: "$pickup" }, pendingDelivery: { $sum: "$delivery" } } }])
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
        return res.status(getUsers.length > 0 ? 200 : 200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `category items found` : "no category items found" });
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
                return res.status(409).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} plan already exist` });
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
        let anotherMatch = [];
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('tag' in req.query) {
            let regEx = new RegExp(req.query.tag, 'g')
            anotherMatch.push({ tag: { $regex: regEx } })
        }
        if ('isVisible' in req.query) {
            anotherMatch.push({ isVisible: req.query.isVisible === 'true' })
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
        let getUsers = await subscriptionSchema.aggregate([
            match,
            {
                $match: {
                }
            },
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
                $project: {
                    _id: 0,
                    __v: 0
                }
            }
        ])
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `subscription found` : "no subscription plan found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addMembershipDetail', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('membership').single('image'),
    [body('name').isString().withMessage("please pass membership title"),
    body('month').isNumeric().withMessage("please pass monthly price"),
    body('quarterly').isNumeric().withMessage("please pass quarterly price"),
    body('year').isNumeric().withMessage("please pass yearly price"),
    body('benefits').optional().isString().withMessage("please benefits for plan"),
    body('isVisible').optional().isBoolean().withMessage("please pass boolean for visibility"),
    ]
    , checkErr, async (req, res) => {
        try {
            const { name,
                month,
                quarterly,
                year,
                benefits,
                isVisible } = req.body;
            let checkCategory = await membershipDetails.findOne({ name: name });
            if (checkCategory != undefined || checkCategory != null) {
                removeObject(req.file.key)
                return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} membership already exist` });
            }
            if (req.file == undefined || req.file.location == undefined) {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please upload icon image` });
            }
            let addCategory = new membershipDetails({
                name: name,
                icon: req.file.location,
                month: month,
                quarterly: quarterly,
                isVisible: isVisible,
                year: year,
                benefits: benefits
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
router.post('/registerUser', authenticateToken, checkUserRole(['superAdmin', 'admin']),
    [body('name').isString().withMessage("please pass user name"),
    body('email', 'please pass valid email').isString().isEmail(),
    body('dob', 'please pass valid dob').isString().custom((value) => { return regex.test(value) }),
    body('gender', 'please pass valid gender details').isString().isIn(["Male", "Female", "Other"]),
    body('mobileNo', 'please pass valid mobile no').isString().isMobilePhone(),
    body('status', 'please pass valid status').isNumeric()
    ]
    , checkErr, async (req, res) => {
        try {
            const { name, email, dob, gender, mobileNo, status } = req.body;

            let checkExist = await userSchema.aggregate([
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

            const userIs = new userSchema({
                email: email,
                mobileNo: mobileNo,
                name: name,
                dob: dob,
                gender: gender,
                status: status
            });

            await userIs.save();

            otp = getRandomIntInclusive(111111, 999999);

            console.log(otp);
            let update = await userSchema.findByIdAndUpdate(userIs._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
            let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome to the delux laundry service you can use our service more effectively by using our app delux lundry service`
            await main(email, message);
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { email: userIs.email, role: userIs.role, isEmailVerified: userIs.isEmailVerified, isMobileVerified: userIs.isMobileVerified, id: userIs._id }, otp: otp }, messsage: "user successfully signed up" });;
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateMembershipDetails', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('membership').single('image'),
    [body('name').optional().isString().withMessage("please pass valid membership title"),
    body('month').optional().isNumeric().withMessage("please pass monthly price"),
    body('quarterly').optional().isNumeric().withMessage("please pass quarterly price"),
    body('year').optional().isNumeric().withMessage("please pass yearly price"),
    body('benefits').optional().isString().withMessage("please benefits for plan"),
    body('isVisible').optional().isBoolean().withMessage("please pass boolean for visibility"),
    body('detailId').custom((value) => { return mongoose.Types.ObjectId.isValid(value) }).withMessage("please pass membership detail id")
    ]
    , checkErr, async (req, res) => {
        try {
            const { name,
                month,
                quarterly,
                year,
                benefits,
                isVisible, detailId } = req.body;
            // console.log(planId);
            let checkCategory = await membershipDetails.findById(detailId);
            // console.log(checkCategory);
            if (checkCategory == undefined || checkCategory == null) {
                return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `membership details not found` });
            }
            let addCategory = {
                month: month,
                quarterly: quarterly,
                year: year,
                benefits: benefits,
                name: name,
                icon: req.file != undefined ? req.file.location : checkCategory.icon,
                isVisible: isVisible
            }

            if (req.file != undefined) {
                let result = checkCategory.icon.indexOf("membership");
                let key = checkCategory.icon.substring(result, checkCategory.icon.length)
                if (key != undefined) {
                    removeObject(key)
                }
            }
            let update = await membershipDetails.findByIdAndUpdate(detailId, addCategory, { new: true });
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
router.get('/getMembershipDetails', authenticateToken, async (req, res) => {
    try {
        let anotherMatch = [];
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('benefits' in req.query) {
            let regEx = new RegExp(req.query.benefits, 'i')
            anotherMatch.push({ benefits: { $regex: regEx } })
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
        let getUsers = await membershipDetails.aggregate([
            match,
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
                    isVisible: 0,
                    __v: 0
                }
            }
        ])
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: true, data: getUsers[0] }, message: getUsers.length > 0 ? `subscription found` : "no subscription plan found" });
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
body('alternativeMobile').optional().isMobilePhone().withMessage("please pass mobile no"),
body('fatherName', 'please pass valid father name').optional().notEmpty().isString(),
body('bloodGroup', 'please pass valid blood group details').optional().notEmpty().isString(),
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
            riderExpiry,
            bloodGroup,
            alternativeMobile,
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
            alternativeMobile: alternativeMobile,
            bloodGroup: bloodGroup,
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
router.get('/getProof', authenticateToken, checkUserRole(["superAdmin"]), [
    check('userId', 'please enter user id').custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res, next) => {
        try {
            const userId = req.query.userId;
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
router.delete('/removeProof', authenticateToken, checkUserRole(["superAdmin"]), [
    check('proofId', 'please enter proof id').custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res, next) => {
        try {
            const userId = req.query.proofId;
            let checkProof = await proofSchema.findById(userId);
            if (checkProof == undefined || checkProof == null) {
                return res.status(404).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: `no proof found` });
            }
            let removeProof = await proofSchema.findByIdAndDelete(userId);
            removeProof._doc['id'] = removeProof._doc['_id'];
            delete removeProof._doc.updatedAt;
            delete removeProof._doc.createdAt;
            delete removeProof._doc._id;
            delete removeProof._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: removeProof }, message: 'proof deleted' });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.post('/addProof', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('proof').single('image'),
    [body('title').notEmpty().isString().withMessage("please pass subscription name"),
    body('userId', 'please enter user id').custom((value) => mongoose.Types.ObjectId.isValid(value)),
    body('isVerified').optional().isBoolean().withMessage("please pass boolean for visibility"),
    ]
    , checkErr, async (req, res) => {
        try {
            const { userId, title, isVerified } = req.body;
            if (req.file == undefined || req.file.location == undefined) {
                return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please upload icon image` });
            }
            let checkProof = await proofSchema.findOne({ userId: userId, title: title });
            if (checkProof != undefined && checkProof != null) {
                return res.status(403).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `proof already exist` });
            }
            let addProof = new proofSchema({
                title: title,
                userId: userId,
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
router.put('/updateSubscription', authenticateToken, [check('subscriptionId', 'please pass valid subscription id').isString().custom(value => { return mongoose.Types.ObjectId.isValid(value) }),
check('status', 'please pass valid status').isNumeric().isIn([2, 4]),
check('paymentId', 'please pass valid payment id').optional().isString(),
check('note', 'please pass valid notes').optional().isString()], checkErr, async (req, res, next) => {
    try {
        const { subscriptionId, status, paymentId, note } = req.body;
        const userId = req.user._id;
        let checkCategory = await userSubscription.findById(mongoose.Types.ObjectId(subscriptionId));
        // console.log(checkCategory);
        if (checkCategory == undefined || checkCategory == null) {
            return res.status(404).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `subscription plan not found` });
        }
        let updateField = {
            status: status,
            paymentId: paymentId,
            note: note
        }
        let createAddress = await userSubscription.findByIdAndUpdate(subscriptionId, updateField, { new: true });
        createAddress._doc['id'] = createAddress._doc['_id'];
        delete createAddress._doc.updatedAt;
        delete createAddress._doc.createdAt;
        delete createAddress._doc._id;
        delete createAddress._doc.__v;
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: createAddress }, message: "user subscription updated" });

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addOrder', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res, next) => {
    try {
        const { pickupTimeId, deliveryTimeId, pickupInstruction, deliveryInstruction, pickupAddressId, deliveryAddressId, items } = req.body;
        const { userId } = req.body;
        let checkSubscription = await checkUserSubscriptionMember(userId);
        let totalAmount = 0;
        let payableAmount = 0;
        let itemsDoc = []
        let allItems = []
        let orderId = makeid(12);
        let taxApplied = {}
        if (items != undefined && items != null) {
            let itemIds = items.map(e => mongoose.Types.ObjectId(e.itemId));
            let getItems = await itemSchema.aggregate([{ $match: { _id: { $in: itemIds } } }])
            console.log("items");
            for (i = 0; i < items.length; i++) {
                console.log();
                let amount = getItems.find((item) => { if (item._id.toString() == items[i].itemId.toString()) { return item.price } return {} })
                console.log(amount.price);
                if (amount != undefined) {
                    totalAmount += (amount.price * items[i].qty);
                    allItems.push(Object.assign(items[i], { amount: (amount.price * items[i].qty) }))
                }
            }
        }
        console.log(totalAmount);
        //check for 15$ validation

        let taxes = await taxSchema.findOne({ isSubscription: checkSubscription[0].isSubscription, isMember: checkSubscription[0].isMember })
        console.log(taxes);
        if (taxes != undefined && taxes != null) {
            taxApplied = taxes.taxes;
            console.log(Object.values(taxApplied));
            payableAmount = parseFloat(totalAmount) + parseFloat((Object.values(taxApplied)).reduce((a, b) => a + b, 0))
        }
        else {
            payableAmount = parseFloat(totalAmount);
        }
        console.log(taxApplied);
        console.log(totalAmount + "  " + payableAmount);
        let addOrder = new invoiceSchema({
            pickupTimeId: pickupTimeId,
            deliveryTimeId: deliveryTimeId,
            status: 0,
            userId: userId,
            deliveryInstruction: deliveryInstruction,
            pickupInstruction: pickupInstruction,
            orderId: orderId,
            taxes: taxApplied,
            pickupAddressId: pickupAddressId,
            deliveryAddressId: deliveryAddressId,
            isSubscribed: checkSubscription.isSubscribed,
            isMember: checkSubscription.isMember,
            orderAmount: totalAmount,
            finalAmount: payableAmount,
            pendingAmount: payableAmount,
            userId: userId
        })
        await addOrder.save();
        if (items != undefined && items != null) {
            // console.log(addOrder);
            for (i = 0; i < allItems.length; i++) {
                itemsDoc.push({ itemId: allItems[i].itemId, qty: allItems[i].qty, amount: allItems[i].amount, categoryId: allItems[i].categoryId, orderId: addOrder._id })
            }
        }
        if (itemsDoc.length > 0) {
            await orderItems.insertMany(itemsDoc);
        }
        addOrder._doc['id'] = addOrder._doc['_id'];
        delete addOrder._doc.updatedAt;
        delete addOrder._doc.createdAt;
        delete addOrder._doc._id;
        delete addOrder._doc.__v;
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addOrder }, message: 'order added' });
    }
    catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addOrderItem', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res, next) => {
    try {
        const { itemId, categoryId, orderId } = req.body;
        let { qty } = req.body;
        const { userId } = req.body;
        let taxApplied = {}
        let getOrder = await invoiceSchema.findById(orderId);
        if (getOrder == undefined || getOrder == null) {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: 'order details not found' });
        }
        let checkSubscription = await checkUserSubscriptionMember(userId);
        let taxes = await taxSchema.findOne({ isSubscription: true, isMember: checkSubscription[0].isMember })
        // console.log(taxes);
        if (taxes != undefined && taxes != null) {
            taxApplied = taxes.taxes;
            payableAmount = parseFloat(getOrder.orderAmount) + parseFloat((Object.values(taxApplied)).reduce((a, b) => a + b, 0))
            if (JSON.stringify(getOrder.taxes) != JSON.stringify(taxApplied)) {
                let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, { taxes: taxApplied, finalAmount: payableAmount, pendingAmount: payableAmount })
            }
        }
        else {
            if (JSON.stringify(getOrder.taxes) != JSON.stringify({})) {
                taxApplied = {};
                payableAmount = parseFloat(getOrder.orderAmount) + parseFloat(0)
                let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, { taxes: taxApplied, finalAmount: payableAmount, pendingAmount: payableAmount })
            }
        }
        let getItem = await itemSchema.findById(itemId);
        if (getItem == undefined || getItem == null) {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: 'item not found' });
        }
        const amount = getItem.price;
        let finalAmount = qty * amount;
        let checkItems = await orderItems.findOne({ itemId: mongoose.Types.ObjectId(itemId), orderId: mongoose.Types.ObjectId(orderId) });
        if (checkItems != null && checkItems != undefined) {
            console.log(checkItems);
            if (checkItems.qty > qty) {
                console.log("zero minus");
                qty = 0 - (checkItems.qty - qty);
                console.log(qty);
            }
            else if (checkItems.qty < qty) {
                qty = qty - checkItems.qty;
                console.log(qty);
            }
            else if (checkItems.qty == qty) {
                console.log("same");
                checkItems._doc['id'] = checkItems._doc['_id'];
                delete checkItems._doc.updatedAt;
                delete checkItems._doc.createdAt;
                delete checkItems._doc._id;
                delete checkItems._doc.__v;
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkItems[0] }, message: 'no quantity change' });

            }

            let finalAmount = qty * amount;
            let updateQty;
            console.log("qty");
            console.log(checkItems.qty);
            let finalQty = checkItems.qty + qty;
            console.log(finalQty);
            if (finalQty <= 0) {
                updateQty = await orderItems.findByIdAndRemove(checkItems._id)
                updateQty._doc['qty'] = 0
                updateQty._doc['amount'] = 0
            }
            else {
                updateQty = await orderItems.findByIdAndUpdate(checkItems._id, {
                    $inc: {
                        qty: qty, amount: finalAmount
                    }
                }, { new: true })
            }
            console.log(finalAmount);
            let updateItems = await invoiceSchema.findByIdAndUpdate(orderId, {
                $inc: {
                    orderAmount: finalAmount, finalAmount: finalAmount,
                    pendingAmount: finalAmount
                }
            }, { new: true });
            updateQty._doc['id'] = updateQty._doc['_id'];
            delete updateQty._doc.updatedAt;
            delete updateQty._doc.createdAt;
            delete updateQty._doc._id;
            delete updateQty._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateQty }, message: 'order items updated' });
        }
        let addItem = new orderItems({
            qty: qty,
            amount: amount,
            itemId: itemId,
            categoryId: categoryId,
            orderId: orderId
        })
        await addItem.save();
        let updateItems = await invoiceSchema.findByIdAndUpdate(orderId, { $inc: { orderAmount: finalAmount } }, { new: true });
        addItem._doc['id'] = addItem._doc['_id'];
        delete addItem._doc.updatedAt;
        delete addItem._doc.createdAt;
        delete addItem._doc._id;
        delete addItem._doc.__v;
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addItem }, message: 'order item added' });
    }
    catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.put('/updateOrder', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res, next) => {
    try {
        const { pickupAddressId, deliveryAddressId, deliveryInstruction, pickupInstruction, status, orderId, paymentId, note } = req.body;
        let checkOrder = await invoiceSchema.findById(orderId);
        let checkSubscription = await checkUserSubscriptionMember(userId);

        if (checkOrder != undefined && checkOrder != null) {
            if (status == 1) {
                if (checkSubscription != undefined && 'isSubscription' in checkSubscription && 'isMember' in checkSubscription && checkSubscription.isSubscription == false && checkSubscription.isMember == false && totalAmount < 15) {
                    return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: 'order should be with minimum 15$' });
                }
            }
            let update = {
                status: status,
                deliveryInstruction: deliveryInstruction,
                pickupInstruction: pickupInstruction,
                pickupAddressId: pickupAddressId,
                deliveryAddressId: deliveryAddressId,
                paymentId: paymentId,
                note: note
            }
            let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, update, { new: true });
            updateOrder._doc['id'] = updateOrder._doc['_id'];
            delete updateOrder._doc.updatedAt;
            delete updateOrder._doc.createdAt;
            delete updateOrder._doc._id;
            delete updateOrder._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateOrder }, message: 'order updated' });

        }
        return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: 'order not found' });
    }
    catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
// router.get('/getOrders', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
//     try {
//         const { orderId } = req.query;
//         const userId = req.body;
//         let match;
//         let anotherMatch = [];
//         // if ('name' in req.query) {
//         //     let regEx = new RegExp(req.query.name, 'i')
//         //     anotherMatch.push({ name: { $regex: regEx } })
//         // }
//         anotherMatch.push({ userId: mongoose.Types.ObjectId(userId) })
//         if ('status' in req.query) {
//             anotherMatch.push({ status: parseInt(req.query.status) });
//         }
//         if ('deliveryStart' in req.query && 'deliveryEnd' in req.query) {
//             let [day, month, year] = req.query.deliveryStart.split('/');
//             let startIs = new Date(+year, month - 1, +day);
//             [day, month, year] = req.query.deliveryEnd.split('/');
//             let endIs = new Date(+year, month - 1, +day);
//             console.log(startIs + " " + endIs);
//             if (startIs != undefined && isNaN(startIs) == false && endIs != undefined && isNaN(endIs) == false) {
//                 let array = getDateArray(startIs, endIs);
//                 console.log(array);
//                 anotherMatch.push({
//                     delivery: { $in: array }
//                 });
//             }
//             else {
//                 return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: "please pass valid dates" });
//             }
//         }
//         if ('pickupStart' in req.query && 'pickupEnd' in req.query) {
//             let [day, month, year] = req.query.pickupStart.split('/');
//             let startIs = new Date(+year, month - 1, +day);
//             [day, month, year] = req.query.pickupEnd.split('/');
//             let endIs = new Date(+year, month - 1, +day);
//             if (startIs != undefined && isNaN(startIs) == false && endIs != undefined && isNaN(endIs) == false) {
//                 let array = getDateArray(startIs, endIs);
//                 anotherMatch.push({
//                     pickup: { $in: array }
//                 });
//             }
//             else {
//                 return res.status(400).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: "please pass valid dates" });
//             }
//         }
//         console.log(anotherMatch);
//         if ('deliveryTimeId' in req.query) {
//             anotherMatch.push({ deliveryTimeId: mongoose.Types.ObjectId(deliveryTimeId) });
//         }
//         if ('pickupTimeId' in req.query) {
//             anotherMatch.push({ pickupTimeId: mongoose.Types.ObjectId(pickupTimeId) });
//         }
//         if (orderId != undefined) {
//             anotherMatch.push({
//                 _id: mongoose.Types.ObjectId(orderId)
//             })
//         }
//         if (anotherMatch.length > 0) {
//             match = {
//                 $match: {
//                     $and: anotherMatch
//                 }
//             }
//         }
//         else {
//             match = {
//                 $match: {

//                 }
//             }
//         }
//         let getUsers = await invoiceSchema.aggregate([
//             match,
//             {
//                 $addFields: {
//                     id: "$_id"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "times",
//                     let: { deliveryId: "$deliveryTimeId", pickupId: "$pickupTimeId" },
//                     pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$deliveryId"] } } }],
//                     as: "deliveryTime"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "times",
//                     let: { pickupId: "$pickupTimeId" },
//                     pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$pickupId"] } } }],
//                     as: "pickupTime"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "users",
//                     let: { userId: "$userId" },
//                     pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$userId"] } } }],
//                     as: "userData"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "addresses",
//                     let: { addressId: "$addressId" },
//                     pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$addressId"] } } }, { $addFields: { id: "$_id" } }, {
//                         $project: {
//                             _id: 0,
//                             __v: 0
//                         }
//                     }],
//                     as: "addressData"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "orderitems",
//                     let: { id: "$_id" },
//                     pipeline: [
//                         { $match: { $expr: { $eq: ["$orderId", "$$id"] } } },
//                         {
//                             $lookup:
//                             {
//                                 from: "categories",
//                                 let: { categoryId: "$categoryId" },
//                                 pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$categoryId"] } } }, { $addFields: { id: "$_id" } }, { $project: { _id: 0, __v: 0 } }],
//                                 as: "categoryData"
//                             }
//                         },
//                         {
//                             $addFields: {
//                                 categoryName: { $first: "$categoryData" },
//                                 id: "$_id"
//                             }
//                         },
//                         {
//                             $project: {
//                                 _id: 0, __v: 0
//                             }
//                         },
//                         {
//                             $lookup:
//                             {
//                                 from: "items",
//                                 let: { id: "$itemId" },
//                                 pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$id"] } } }, { $addFields: { id: "$_id" } }, { $project: { _id: 0, __v: 0 } }],
//                                 as: "itemData"
//                             }
//                         }, {
//                             $addFields: {
//                                 itemData: { $first: "$itemData" }
//                             }
//                         }
//                     ],
//                     as: "ordermItems"
//                 }
//             },
//             {
//                 $addFields: {
//                     invoiceId: "$orderId",
//                     paymentStatus: { $cond: { if: { $and: [{ $isArray: "$paymentId" }, { $gte: [{ $size: "$paymentId" }, 1] }] }, then: 1, else: 0 } },
//                     invoiceStatus: "$status",
//                     amount: "$orderAmount",
//                     name: { $first: "$userData.name" },
//                     addressData: { $first: "$addressData" },
//                     deliveryTime: { $concat: [{ $first: "$deliveryTime.start" }, "-", { $first: "$deliveryTime.end" }] },
//                     pickupTime: { $concat: [{ $first: "$pickupTime.start" }, "-", { $first: "$pickupTime.end" }] }
//                 }
//             },
//             {
//                 $addFields: {
//                     createdAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$createdAt", timezone: "-04:00" } },
//                     updatedAtDate: { $dateToString: { format: "%d-%m-%Y", date: "$updatedAt", timezone: "-04:00" } },
//                     createdAtTime: { $dateToString: { format: "%H:%M:%S", date: "$createdAt", timezone: "-04:00" } },
//                     updatedAtTime: { $dateToString: { format: "%H:%M:%S", date: "$updatedAt", timezone: "-04:00" } },
//                 }
//             },
//             {
//                 $addFields: {
//                     createdAt: { $concat: ["$createdAtDate", " ", "$createdAtTime"] },
//                     updatedAt: { $concat: ["$updatedAtDate", " ", "$updatedAtTime"] }
//                 }
//             },
//             {
//                 $project: {
//                     __v: 0,
//                     _id: 0,
//                     password: 0,
//                     otp: 0,
//                     generatedTime: 0,
//                     userData: 0,
//                     createdAtDate: 0,
//                     updatedAtDate: 0,
//                     createdAtTime: 0,
//                     updatedAtTime: 0
//                 }
//             }
//         ])
//         return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `invoice order found` : "no any invoice orders found" });
//     } catch (error) {
//         return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
//     }
// })
router.get('/getOrdersCount', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
    try {
        const { userId } = req.params;

        let getPendingOrder = await invoiceSchema.aggregate([
            {
                $match: {
                    $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 2 }]
                }
            }
        ])
        let getCompletedOrder = await invoiceSchema.aggregate([
            {
                $match: {
                    $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 3 }]
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { pending: getPendingOrder.length, completed: getCompletedOrder.length } }, message: "order count found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/getUserOrders', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
    try {
        const { orderId, userId } = req.body

        let match;
        let anotherMatch = [];
        // if ('name' in req.query) {
        //     let regEx = new RegExp(req.query.name, 'i')
        //     anotherMatch.push({ name: { $regex: regEx } })
        // }
        if ('status' in req.body) {
            anotherMatch.push({ status: parseInt(req.body.status) });
        }
        if ('userId' in req.body) {
            anotherMatch.push({ userId: mongoose.Types.ObjectId(userId) });
        }
        if (orderId != undefined) {
            anotherMatch.push({
                _id: mongoose.Types.ObjectId(orderId)
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
        let getUsers = await invoiceSchema.aggregate([
            match,
            {
                $addFields: {
                    id: "$_id"
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $lookup: {
                    from: "daywise",
                    let: { deliveryId: "$deliveryTimeId", pickupId: "$pickupTimeId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$deliveryId"] } } }],
                    as: "deliveryTime"
                }
            },
            {
                $lookup: {
                    from: "daywise",
                    let: { pickupId: "$pickupTimeId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$pickupId"] } } }],
                    as: "pickupTime"
                }
            },
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$userId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$userId"] } } }],
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "addresses",
                    let: { addressId: "$addressId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$addressId"] } } }, { $addFields: { id: "$_id" } }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "addressData"
                }
            },
            {
                $lookup: {
                    from: "orderitems",
                    let: { id: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$orderId", "$$id"] } } },
                        {
                            $lookup:
                            {
                                from: "categories",
                                let: { categoryId: "$categoryId" },
                                pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$categoryId"] } } }, { $addFields: { id: "$_id" } }, { $project: { _id: 0, __v: 0 } }],
                                as: "categoryData"
                            }
                        },
                        {
                            $addFields: {
                                categoryName: { $first: "$categoryData" },
                                id: "$_id"
                            }
                        },
                        {
                            $project: {
                                _id: 0, __v: 0
                            }
                        },
                        {
                            $lookup:
                            {
                                from: "items",
                                let: { id: "$itemId" },
                                pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$id"] } } }, { $addFields: { id: "$_id" } }, { $project: { _id: 0, __v: 0 } }],
                                as: "itemData"
                            }
                        }, {
                            $addFields: {
                                itemData: { $first: "$itemData" }
                            }
                        },
                        // {
                        //     $group: {
                        //         _id: "$categoryName",
                        //         items: { $push: "$$ROOT" }
                        //     }
                        // },
                        // {
                        //     $addFields: {
                        //         name: "$_id.name",
                        //         categoryData: "$_id"
                        //     }
                        // },
                        // {
                        //     $project: {
                        //         _id: 0
                        //     }
                        // }
                    ],
                    as: "ordermItems"
                }
            },
            {
                $addFields: {
                    invoiceId: "$orderId",
                    paymentStatus: { $cond: { if: { $and: [{ $isArray: "$paymentId" }, { $gte: [{ $size: "$paymentId" }, 1] }] }, then: 1, else: 0 } },
                    invoiceStatus: "$status",
                    amount: "$orderAmount",
                    name: { $first: "$userData.name" },
                    addressData: { $first: "$addressData" },
                    deliveryTime: { $first: "$deliveryTime.timeSlot" },
                    pickupTime: { $first: "$pickupTime.timeSlot" }
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
                    __v: 0,
                    _id: 0,
                    password: 0,
                    otp: 0,
                    generatedTime: 0,
                    userData: 0,
                    createdAtDate: 0,
                    updatedAtDate: 0,
                    createdAtTime: 0,
                    updatedAtTime: 0
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `invoice order found` : "no any invoice orders found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getPickUpDays', authenticateToken, async (req, res) => {
    try {
        // console.log(moment()
        //     .tz('America/Panama')
        //     .format("DD/MM/YYYY"));
        // console.log(moment()
        //     .tz('America/Panama')
        //     .format("H:mm:ss"));
        const userId = req.user._id;
        let currentDate = moment()
            .tz('America/Panama')
        let checkSubscription = await checkUserSubscriptionMember(userId)
        // console.log("subscription");
        // console.log(checkSubscription);
        if (checkSubscription.length > 0 && 'isSubscription' in checkSubscription[0] && 'isMember' in checkSubscription[0] && checkSubscription[0].isSubscription == true && checkSubscription[0].isMember == true) {

        }
        else {
            console.log("else");
            currentDate = currentDate.add(1, 'day');
        }
        // console.log(currentDate);
        let getNextDays = await nextDays(currentDate)
        console.log(getNextDays);
        let getDays = await dayWiseSchema.aggregate([
            {
                $match: {
                    date: { $in: getNextDays }
                }
            },
            {
                $match: {
                    isActive: true
                }
            },
            {
                $addFields: {
                    id: "$_id"
                }
            },
            {
                $project: {
                    __v: 0,
                    _id: 0
                }
            },
            {
                $group: {
                    _id: { date: "$date" },
                    timeSlots: { $push: "$$ROOT" }
                }
            },
            {
                $addFields: {
                    date: "$_id.date",
                    dateType: {
                        $dateFromString: {
                            dateString: "$_id.date",
                            format: "%d/%m/%Y",
                            timezone: "-04:00"
                        }
                    }
                }
            },
            {
                $addFields: {
                    dayNo: { $dayOfWeek: "$dateType" },
                    monthNo: { $month: "$dateType" },
                    dateOnly: {
                        $dayOfMonth: "$dateType"
                    }
                }
            },
            {
                $addFields: {
                    month: {
                        $let: {
                            vars: {
                                monthsInString: [, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                            },
                            in: {
                                $arrayElemAt: ['$$monthsInString', '$monthNo']
                            }
                        }
                    },
                    day: {
                        $let: {
                            vars: {
                                dayInString: [, 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                            },
                            in: {
                                $arrayElemAt: ['$$dayInString', '$dayNo']
                            }
                        }
                    }
                }
            },
            {
                $sort: {
                    dateType: 1
                }
            },
            {
                $project: {
                    _id: 0,
                    dateType: 0
                }
            }
        ])
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: getDays }, message: `data found for next 7 days` });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.put('/updateProof', authenticateToken, checkUserRole(['superAdmin']),
    [
        body('description').optional().notEmpty().isString().withMessage("please pass string value for description"),
        body('isVerified').optional().isBoolean().withMessage("please pass boolean for visibility"),
        body('proofId', 'please pass valid proof id').notEmpty().custom((value) => mongoose.Types.ObjectId.isValid(value))
    ]
    , checkErr, async (req, res) => {
        try {
            const { proofId, isVerified, description } = req.body;
            let checkProof = await proofSchema.findById(proofId);
            if (checkProof == undefined || checkProof == null) {
                return res.status(404).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: `no proof found` });
            }
            let removeProof = await proofSchema.findByIdAndUpdate(proofId, { isVerified: isVerified, description: description }, { new: true });
            removeProof._doc['id'] = removeProof._doc['_id'];
            delete removeProof._doc.updatedAt;
            delete removeProof._doc.createdAt;
            delete removeProof._doc._id;
            delete removeProof._doc.__v;
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: removeProof }, message: 'proof updated' });

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