var express = require('express');
var router = express.Router();
const moment = require('moment');
const { default: mongoose } = require('mongoose');
const userSchema = require('../models/userModel');
const { getCurrentDateTime24 } = require('../utility/dates');
/* GET home page. */
router.get('/', async function (req, res, next) {
    console.log(validatePhoneNumber("9999999999"));
    console.log(validateEmail("abc@gmail.com"))
    res.render('index', { title: 'Express' });
});
router.post('/signUp', async (req, res, next) => {
    try {
        const { name, email, password, mobileNo, role } = req.body;

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
            return res.status(409).json({ IsSuccess: true, Data: [], Messsage: "user already exist" });
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
            role: role,
            password: password
        });

        await userIs.save();

        let user = {
            name: name,
            mobileNo: mobileNo
        }

        res.status(200).json({ IsSuccess: true, Data: [user], Messsage: "user successfully signed up" });
        otp = getRandomIntInclusive(111111, 999999);
        console.log(otp);
        let update = await userSchema.findByIdAndUpdate(userIs._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
        let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
        await main(email, message);
        return;
    } catch (error) {
        return res.status(500).json({ IsSuccess: false, Data: [], Message: error.message || "Having issue is server" })
    }
})
router.post('/login', async (req, res, next) => {
    try {
        const { password, mobileNo } = req.body;

        isEmail = false;
        if (validateEmail(mobileNo)) {
            isEmail = true
        }
        else if (validatePhoneNumber(mobileNo)) {
            isEmail = false;
        }
        else {
            return res.status(400).json({ IsSuccess: true, Data: [], Messsage: "please use correct mobile no or email" });
        }

        if (isEmail) {
            checkExist = await userSchema.aggregate([
                {
                    $match: {
                        email: mobileNo
                    }
                }
            ]);
        }
        else {
            checkExist = await userSchema.aggregate([
                {
                    $match: {
                        mobileNo: mobileNo
                    }
                }
            ]);
        }


        if (checkExist.length > 0) {
            if (checkExist[0].password != password) {
                return res.status(401).json({ IsSuccess: true, Data: [], Messsage: "Incorrect Password" });
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
            res.status(200).json({ IsSuccess: true, Data: checkExist, Messsage: "user found" });
            otp = getRandomIntInclusive(111111, 999999);
            let update = await userSchema.findByIdAndUpdate(checkExist[0]._id, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
            let message = `<h1>Hello Dear User</h1><br/><br/><p>welcome back!</p><br>Your otp is ${otp} , Please Do not share this otp with anyone<br/> This otp is valid for one minute only`
            await main(checkExist[0].email, message);
            return
        }
        return res.status(404).json({ IsSuccess: true, Data: [], Messsage: "user not found" });
    } catch (error) {
        return res.status(500).json({ IsSuccess: false, Data: [], Message: error.message || "Having issue is server" })
    }
})


//authenticate otp and update for verified status
router.post('/authenticateOtpLogin', async (req, res, next) => {
    try {
        const { otp, userId } = req.body;

        let checkUser = await userSchema.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId(userId)
                }
            }
        ]);

        if (checkUser.length == 0) {
            return res.status(404).json({ IsSuccess: true, status: 3, Data: [], Messsage: `No User Found With ${userId}` });
        }
        if (checkUser[0].isVerified) {
            return res.status(409).json({ IsSuccess: true, status: 4, Data: [], Messsage: `User already verified` });
        }
        const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
        const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
        const timeIs = moment();
        console.log(startIs)
        if (timeIs >= startIs && timeIs <= endIs) {
            //otp valid
            if (checkUser[0].otp == otp) {
                let update = await userSchema.findByIdAndUpdate(userId, { isVerified: true }, { new: true });
                return res.status(200).json({ IsSuccess: true, status: 0, Data: [], Messsage: `otp verifed successfully` });
            }
            else {
                return res.status(401).json({ IsSuccess: true, status: 2, Data: [], Messsage: `incorrect otp` });
            }
            console.log("valid")
        }
        else {
            //otp expired
            return res.status(410).json({ IsSuccess: true, status: 1, Data: [], Messsage: `otp expired` });
        }

    } catch (error) {
        return res.status(500).json({ IsSuccess: false, Data: [], Message: error.message || "Having issue is server" })
    }
})

//return response for otp verification only
router.post('/authenticateOtp', async (req, res, next) => {
    try {
        const { otp, userId } = req.body;

        let checkUser = await userSchema.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId(userId)
                }
            }
        ]);

        if (checkUser.length == 0) {
            return res.status(404).json({ IsSuccess: true, status: 3, Data: [], Messsage: `No User Found With ${userId}` });
        }
        const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
        const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
        const timeIs = moment();
        console.log(startIs)
        if (timeIs >= startIs && timeIs <= endIs) {
            //otp valid
            if (checkUser[0].otp == otp) {
                return res.status(200).json({ IsSuccess: true, status: 0, Data: [], Messsage: `otp verifed successfully` });
            }
            else {
                return res.status(401).json({ IsSuccess: true, status: 2, Data: [], Messsage: `incorrect otp` });
            }
            console.log("valid")
        }
        else {
            //otp expired
            return res.status(410).json({ IsSuccess: true, status: 1, Data: [], Messsage: `otp expired` });
        }

    } catch (error) {
        return res.status(500).json({ IsSuccess: false, Data: [], Message: error.message || "Having issue is server" })
    }
})
const nodemailer = require("nodemailer");

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
            user: "jaynikpatel119977.jp@gmail.com", // generated ethereal user
            pass: "saliojbxyvubugty", // generated ethereal password
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
