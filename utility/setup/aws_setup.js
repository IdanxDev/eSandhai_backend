require("dotenv").config();
const { S3Client } = require('@aws-sdk/client-s3')
console.log(process.env.ACCESS_KEY_S3);
console.log(process.env.SECRET_ACCESS_KEY_S3);
var s3 = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_S3,
        secretAccessKey: process.env.SECRET_ACCESS_KEY_S3
    }
})
module.exports = s3;