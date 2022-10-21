var express = require('express');
var router = express.Router();
const moment = require('moment');
const momentTz = require('moment-timezone')
require('dotenv').config();
const { default: mongoose } = require('mongoose');
const userSchema = require('../models/userModel');
const { getCurrentDateTime24 } = require('../utility/dates');
const nodemailer = require("nodemailer");
const { check, body, oneOf } = require('express-validator')
const { main } = require('../utility/mail')
const { sendSms } = require('../utility/sendSms');
const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const { getPlaces, placeFilter, formatAddress } = require('../utility/mapbox')
const { generateAccessToken, authenticateToken, generateRefreshToken, checkUserRole, authenticateTokenWithUserId } = require('../middleware/auth');
const addressSchema = require('../models/addressSchema');
const { checkErr } = require('../utility/error');
const userSubscription = require('../models/userSubscription');
const subscriptionSchema = require('../models/subscriptionSchema')
const riderSchema = require('../models/riderSchema');
const { uploadProfileImageToS3, removeObject } = require('../utility/aws');
/* GET home page. */
router.get('/', async function (req, res, next) {
    console.log(validatePhoneNumber("9999999999"));
    console.log(validateEmail("abc@gmail.com"))
    res.render('index', { title: 'Express' });
});
router.post('/signUp', authenticateToken, checkUserRole(['superAdmin', 'admin']), [body('email').isEmail().withMessage("please pass email id"),
body('name').isString().withMessage("please pass name"),
body('role').optional().isIn(["rider"]).withMessage("please pass valid role"),
body('gender').isIn(["Male", "Female", "Other"]).withMessage("please pass valid gender value"),
body('dob').custom((value) => { return regex.test(value) }).withMessage("please pass dob"),
body('countryCode', 'please pass valid country code').notEmpty().custom((value) => { return value.startsWith("+") }),
body('mobileNo').isMobilePhone().withMessage("please pass mobile no")], checkErr, async (req, res, next) => {
    try {
        const { name, gender, dob, role, mobileNo, countryCode, email } = req.body;

        let checkExist = await riderSchema.aggregate([
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
            return res.status(409).json({ issuccess: false, data: { acknowledgement: false }, message: "rider already exist" });
        }

        // const userLoginIs = new userLogin({
        //   userName: userName,
        //   password: password
        // });

        // await userLoginIs.save();
        var randomstring = Math.floor(100000000000 + Math.random() * 900000000000);

        const userIs = new riderSchema({
            email: email,
            mobileNo: mobileNo,
            name: name,
            gender: gender,
            dob: dob,
            countryCode: countryCode,
            username: randomstring,
            role: role
        });

        await userIs.save();
        userIs._doc['id'] = userIs._doc['_id'];
        delete userIs._doc.updatedAt;
        delete userIs._doc.createdAt;
        delete userIs._doc._id;
        delete userIs._doc.__v;
        delete userIs._doc.generatedTime;
        delete userIs._doc.otp

        let message = `<h1>Hello ${name}</h1><br/><br/><p>welcome to delux laundry system</p><br> Your registration successful now , Please start your work as scheduled`
        await main(email, message);
        await sendSms(countryCode + mobileNo, `Helllo ${name}, welcome to delux laundry system <br> Your registration successful now , Please start your work as scheduled`);

        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: userIs }, message: "sign up successfully" });;
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/login', [body('mobileNo').isMobilePhone().withMessage("please pass mobile no"), body('countryCode').isString().withMessage("please pass countrycode")], checkErr, async (req, res, next) => {
    try {
        const { mobileNo, countryCode } = req.body;

        let checkExist = await riderSchema.aggregate([
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

            let update = await riderSchema.findByIdAndUpdate(checkExist[0]._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
            await sendSms(countryCode + mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);
            return;
            // return res.status(409).json({ IsSuccess: true, Data: [], Messsage: "user already exist" });
        }
        return res.status(404).json({ issuccess: false, data: { acknowledgement: false }, message: "user not found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/updateUser', authenticateToken, uploadProfileImageToS3('rider').single('image'), [body('name', 'please enter valid name').optional().notEmpty().isString(),
body('gender', "please pass dob").optional().isIn(["Male", "Female", "Other"]),
body('dob', "please pass dob").optional().custom((value) => { return regex.test(value) }),
body('jobStatus', 'please enter valid status').optional().isBoolean(),
body('activeStatus', 'please enter valid active status').optional().isNumeric()
], checkErr, async (req, res, next) => {
    try {
        const { name,
            dob,
            gender,
            jobStatus,
            activeStatus } = req.body;

        const userId = req.user._id

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
router.get('/getProfile', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user._id

        const checkUser = await riderSchema.aggregate([
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
                    "_id": 0,
                    "__v": 0,
                    "otp": 0
                }
            }
        ]);
        if (checkUser.length == 0) {
            return res.status(404).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: "no user details found" });

        }
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkUser[0] }, message: "user details found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.post('/resendOtp', [oneOf([body('id').isEmail(), body('id').isMobilePhone()], "please pass email or mobile no")], checkErr, async (req, res, next) => {
    try {
        const { id } = req.body;
        let checkOtp = await riderSchema.aggregate([
            {
                $match: {
                    $and: [
                        { $or: [{ email: id }, { mobileNo: id }] }
                    ]
                }
            }
        ])
        if (checkOtp.length == 0) {
            return res.status(404).json({ issuccess: false, data: { acknowledgement: false }, message: "no user found with this ids" });
        }

        otp = getRandomIntInclusive(111111, 999999);
        res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: otp }, message: "Otp sent successfully" });

        let update = await riderSchema.findByIdAndUpdate(checkOtp[0]._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
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

        let checkUser = await riderSchema.aggregate([
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
            return res.status(404).json({ issuccess: false, data: { acknowledgement: false, status: 3 }, message: `No User Found With ${id}` });
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
            let update = await riderSchema.findByIdAndUpdate(checkUser[0]._id, updateData, { new: true });
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
                let update = await riderSchema.findByIdAndUpdate(checkUser[0]._id, updateData, { new: true });
                const {
                    generatedToken, refreshToken } = await generateAccessToken({ _id: checkUser[0]._id, role: checkUser[0].role })
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, status: 0, generatedToken: generatedToken, refreshToken: refreshToken }, message: `otp verifed successfully` });
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
        console.log(error.message);
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})

//return response for otp verification only
router.post('/authenticateOtp', [oneOf([body('id').isEmail(), body('id').isMobilePhone()], "please pass email or mobile no"), body('otp').isNumeric().withMessage("please pass otp")], checkErr, async (req, res, next) => {
    try {
        const { otp, id } = req.body;

        let checkUser = await riderSchema.aggregate([
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
            return res.status(404).json({ issuccess: false, data: { acknowledgement: false, status: 3 }, message: `No User Found With ${userId}` });
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
router.put('/updateWithOtp', authenticateTokenWithUserId, [oneOf([body('id').isEmail(), body('id').isMobilePhone()], "please pass email or mobile no"), body('otp').isNumeric().withMessage("please pass otp"), body('userId', 'please pass userId').optional().custom((value) => mongoose.Types.ObjectId.isValid(value))], checkErr, async (req, res, next) => {
    try {
        const { otp, id } = req.body;
        let userId = req.body.userId;;
        if ((userId == undefined || userId == null) && (req.user != undefined && 'id' in req.user)) {
            userId = req.user._id;
        }
        if (userId == undefined || userId == null) {
            return res.status(400).json({ issuccess: false, data: { acknowledgement: false }, message: `please send valid request` });
        }
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
router.get('/getUsers', authenticateToken, checkUserRole(["superAdmin", "admin"]), async (req, res) => {
    let getUsers = await riderSchema.aggregate([
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
            $project: {
                _id: 0,
                __v: 0,
                generatedTime: 0,
                otp: 0,
                createdAt: 0,
                updatedAt: 0
            }
        }
    ])
    return res.status(410).json({ issuccess: true, data: { acknowledgement: true, data: getUsers }, message: getUsers.length > 0 ? `users found` : "no user found" });
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
// async..await is not allowed in global scope, must use a wrapper


module.exports = router;
