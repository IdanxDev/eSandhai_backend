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
const regex = /^(1[0-2]|0[1-9])\/(3[01]|[12][0-9]|0[1-9])\/[0-9]{4}$/;
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

        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { email: userIs.email, role: userIs.role, mobileNo: userIs.mobileNo, isEmailVerified: userIs.isEmailVerified, isMobileVerified: userIs.isMobileVerified, id: userIs._id } }, Messsage: "user successfully signed up" });;
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
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `users found` : "no user found" });
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
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `admin users found` : "no user found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addCategory', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('icons').single('image'),
    [body("name").isString().withMessage("please provide valid category name"),
    body('description').optional().isString().withMessage("please provide valid description"),
    body('isVisible').optional().isBoolean().withMessage("please provide valid visibility field")], checkErr, async (req, res) => {
        try {
            const { name, description, isVisible } = req.body;
            let checkCategory = await categorySchema.findOne({ name: name });
            console.log(req.file);
            if (checkCategory != undefined || checkCategory != null) {
                removeObject(req.file.key)
                return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} already registered` });
            }
            let addCategory = new categorySchema({
                name: name,
                icon: req.file.location,
                description: description,
                isVisible: isVisible
            })

            await addCategory.save();
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addCategory }, message: `${name} successfully added` });
        } catch (error) {
            return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
        }
    })
router.put('/updateCategory', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('icons').single('image'), [body("name").optional().isString().withMessage("please provide valid category name"),
body('description').optional().isString().withMessage("please provide valid description"),
body('isVisible').optional().isBoolean().withMessage("please provide valid visibility field"),
body('categoryId').custom((value) => { return mongoose.Types.ObjectId.isValid(value) }).withMessage("please provide category id")], checkErr, async (req, res) => {
    try {
        const { name, categoryId, description, isVisible } = req.body;

        let checkCategory = await categorySchema.findById(categoryId);
        if (checkCategory == undefined || checkCategory == null) {
            return res.status(404).json({ issuccess: true, data: { acknowledgement: true, data: null }, message: `Categoory not found` });
        }
        let addCategory = {
            name: name,
            icon: req.file != undefined ? req.file.location : checkCategory.location,
            isVisible: isVisible,
            description: description
        }

        if (req.file != undefined) {
            let result = checkCategory.icon.indexOf("icons");
            let key = checkCategory.icon.substring(result, checkCategory.icon.length)
            if (key != undefined) {
                removeObject(key)
            }
        }
        let update = await categorySchema.findByIdAndUpdate(categoryId, addCategory, { new: true });
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: update }, message: `${update.name} successfully updated` });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getCategory', authenticateToken, async (req, res) => {
    try {
        let getUsers = await categorySchema.aggregate([
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
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `category found` : "no category found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/addPlan', authenticateToken, checkUserRole(['superAdmin']), uploadProfileImageToS3('plans').single('image'),
    [body('name').isString().withMessage("please pass subscription name"),
    body('pickup').isNumeric().withMessage("please pass numeric pickup"),
    body('delivery').isNumeric().withMessage("please pass delivery numbers"),
    body('month').isNumeric().withMessage("please pass monthly price"),
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
                year,
                tag,
                isVisible } = req.body;
            let checkCategory = await subscriptionSchema.findOne({ name: name, pickup: pickup, delivery: delivery, month: month, year: year });
            if (checkCategory != undefined || checkCategory != null) {
                removeObject(req.file.key)
                return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `${name} plan already exist` });
            }
            if (req.file == undefined || req.file.location == undefined) {
                return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `please upload icon image` });
            }
            let addCategory = new subscriptionSchema({
                name: name,
                icon: req.file.location,
                pickup: pickup,
                delivery: delivery,
                month: month,
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
                year,
                tag,
                isVisible, planId } = req.body;
            // console.log(planId);
            let checkCategory = await subscriptionSchema.findById(mongoose.Types.ObjectId(planId));
            // console.log(checkCategory);
            if (checkCategory == undefined || checkCategory == null) {
                return res.status(404).json({ issuccess: true, data: { acknowledgement: true, data: null }, message: `Categoory not found` });
            }
            let addCategory = {
                pickup: pickup,
                delivery: delivery,
                month: month,
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
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `category found` : "no category found" });
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