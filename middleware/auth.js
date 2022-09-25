require('dotenv').config()
const jwt = require('jsonwebtoken');
// const client = require('../services/redis')

//this function used for generate accesss token from refresh token
function generateRefreshToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const refreshToken = authHeader && authHeader.split(' ')[1]
        // console.log(refreshToken);
        if (refreshToken == null) return res.status(401).json({ issuccess: false, data: { acknowledgement: false }, message: "please send valid request" });

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
            if (err) return res.status(403).json({ issuccess: false, data: { acknowledgement: false }, message: "Token Expired or Invalid Token" });
            // let getData = await client.get(user._id + "" + user.deviceId);
            // if (!getData) {
            //     return res.status(440).json({ issuccess: true, data: { acknowledgement: true }, message: "session expired" });
            // }
            // if (getData && getData == "0") {
            //     return res.status(440).json({ issuccess: true, data: { acknowledgement: true }, message: "session logged out" });
            // }
            const accessToken = await generateAccessTokenOnly({
                _id: user._id,
                // deviceId: user.deviceId,
                timestamp: Date.now()
            })
            // console.log(accessToken)
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, token: accessToken }, message: "Here is your token" });
            next();
        })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: "having issue on server" || err.message })
    }

}

//authenticate access token
async function authenticateToken(req, res, next) {
    // console.log(req.headers)
    const authHeader = req.headers['authorization']
    // console.log(authHeader)
    const token = authHeader && authHeader.split(' ')[1] || req.signedCookies.access_token
    // console.log(token);

    if (!token) return res.status(401).json({ issuccess: false, data: { acknowledgement: false }, message: "please send valid request" });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ issuccess: false, data: { acknowledgement: false }, message: "Token Expired or Invalid Token" });
        // console.log(user);
        req.user = {
            _id: user._id,
            // deviceId: user.deviceId
        }
        // let getData = await client.get(user._id + "" + user.deviceId);
        // if (!getData) {
        //     return res.status(440).json({ issuccess: true, data: { acknowledgement: true }, message: "session expired" });
        // }
        // if (getData && getData == "0") {
        //     return res.status(440).json({ issuccess: true, data: { acknowledgement: true }, message: "session logged out" });
        // }
        next()
    })
}
//authenticate access token
async function authenticateTokenWithUserId(req, res, next) {
    // console.log(req.headers)
    if (req.body.hasOwnProperty('userId')) {
        next();
        return;
    }
    const authHeader = req.headers['authorization']
    // console.log(authHeader)
    const token = authHeader && authHeader.split(' ')[1] || req.signedCookies.access_token
    // console.log(token);
    if (!token) return res.status(401).json({ issuccess: false, data: { acknowledgement: false }, message: "please send valid request" });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(403).json({ issuccess: false, data: { acknowledgement: false }, message: "Token Expired or Invalid Token" });
        // console.log(user);
        req.user = {
            _id: user._id
        }
        next()
    })
}

function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};

//generate access token and refesh token for user
async function generateAccessToken(user) {
    console.log("user token");
    console.log(user);
    const generatedToken = jwt.sign({ _id: user._id, time: Date.now() }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10d' })
    const refreshToken = jwt.sign({ _id: user._id, time: Date.now() }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '10d' })
    // console.log(generatedToken);
    // await client.set(user._id + "" + user.deviceId, refreshToken);
    return {
        generatedToken: generatedToken, refreshToken: refreshToken
    }
}

//generate access token only using refreshtoken
async function generateAccessTokenOnly(user) {
    const generatedToken = jwt.sign({ _id: user._id, deviceId: user.deviceId, time: Date.now() }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10d' })
    return generatedToken;
}

module.exports = {
    authenticateToken: authenticateToken,
    generateAccessToken: generateAccessToken,
    generateRefreshToken: generateRefreshToken,
    authenticateTokenWithUserId: authenticateTokenWithUserId
}
