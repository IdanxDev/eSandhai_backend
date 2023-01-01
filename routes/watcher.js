var express = require('express');
const { default: mongoose } = require('mongoose');
var router = express.Router();

const invoiceSchema = require("../models/invoiceSchema");
const orderState = require("../models/orderState");

invoiceSchema.watch([], { fullDocumentBeforeChange: "whenAvailable" }).on('change', async data => {
    try {
        console.log(data);
        if (data != undefined || data != null) {
            if (data != undefined && data.operationType == 'update') {
                let getLastState = await orderState.aggregate([{
                    $match: {
                        orderId: mongoose.Types.ObjectId(data.documentKey._id)
                    }
                }]);
                if (getLastState.length > 0) {
                    let getOrder = await invoiceSchema.findById(data.documentKey._id)
                    if (getLastState[getLastState.length - 1].to != getOrder.status) {
                        let addState = new orderState({
                            from: getLastState[getLastState.length - 1].to,
                            to: getOrder.status,
                            orderId: data.documentKey._id
                        })
                        await addState.save();
                    }
                }
            }
            else if (data != undefined && data.operationType == 'insert') {
                let addState = new orderState({
                    from: data.fullDocument.status,
                    to: data.fullDocument.status,
                    orderId: data.fullDocument._id
                })
                await addState.save();
            }
        }
    }
    catch (err) {
        console.log(err.message || "having issue on friend");
    }
})

module.exports = router;