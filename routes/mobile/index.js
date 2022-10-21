var express = require('express');
var router = express.Router();
const authRouter = require('./auth');
const service = require('./services')
router.use('/auth', authRouter);
router.use('/services', service);

module.exports = router;
