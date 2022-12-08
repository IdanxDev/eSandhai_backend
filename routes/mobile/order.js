var express = require('express');
var router = express.Router();
const moment = require('moment');
const momentTz = require('moment-timezone')
require('dotenv').config();
const bcrypt = require('bcrypt');
const { default: mongoose } = require('mongoose');
const userSchema = require('../../models/userModel');
const { getCurrentDateTime24, makeid } = require('../../utility/dates');
const nodemailer = require("nodemailer");
const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const { checkExpireSubscription, checkExpireMemberShip, checkUserSubscriptionMember, getDateArray, nextDays } = require('../../utility/expiration');
const { generateAccessToken, authenticateToken, generateRefreshToken, checkUserRole } = require('../../middleware/auth');
const taxSchema = require('../../models/taxSchema')
const invoiceSchema = require('../../models/invoiceSchema');
const orderItems = require('../../models/orderItems');
const itemSchema = require('../../models/itemSchema');
const dayWiseSchema = require('../../models/dayWiseSchema');
const couponSchema = require('../../models/couponSchema');
router.post('/addOrder', authenticateToken, async (req, res, next) => {
    try {
        const { pickupTimeId, deliveryTimeId, pickupInstruction, deliveryInstruction, pickupAddressId, deliveryAddressId, items } = req.body;
        const userId = req.user._id;
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
        // console.log(checkSubscription);
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
// router.post('/addOrderItem', authenticateToken, async (req, res, next) => {
//     try {
//         const { qty, itemId, categoryId, orderId } = req.body;
//         const userId = req.user._id;
//         let taxApplied = {}
//         let getOrder = await invoiceSchema.findById(orderId);
//         if (getOrder == undefined || getOrder == null) {
//             return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: 'order details not found' });
//         }
//         let checkSubscription = await checkUserSubscriptionMember(userId);
//         let taxes = await taxSchema.findOne({ isSubscription: true, isMember: checkSubscription[0].isMember })
//         let payableAmount = 0;
//         // console.log(taxes);
//         if (taxes != undefined && taxes != null) {
//             taxApplied = taxes.taxes;
//             payableAmount = parseFloat((Object.values(taxApplied)).reduce((a, b) => a + b, 0))
//             // if (JSON.stringify(getOrder.taxes) != JSON.stringify(taxApplied)) {
//             //     let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, { taxes: taxApplied, finalAmount: payableAmount, pendingAmount: payableAmount })
//             // }
//         }
//         else {
//             if (JSON.stringify(getOrder.taxes) != JSON.stringify({})) {
//                 taxApplied = {};
//                 payableAmount = parseFloat(getOrder.orderAmount) + parseFloat(0)
//                 // let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, { taxes: taxApplied, finalAmount: payableAmount, pendingAmount: payableAmount })
//             }
//         }
//         let getItem = await itemSchema.findById(itemId);
//         if (getItem == undefined || getItem == null) {
//             return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: 'item not found' });
//         }
//         const amount = getItem.price;
//         let finalAmount = qty * amount;
//         let checkItems = await orderItems.findOne({ itemId: mongoose.Types.ObjectId(itemId), orderId: mongoose.Types.ObjectId(orderId) });
//         if (checkItems != null && checkItems != undefined) {
//             let updateQty;
//             console.log("qty");
//             console.log(checkItems.qty);
//             let finalQty = checkItems.qty + qty;
//             console.log(finalQty);
//             if (finalQty <= 0) {
//                 updateQty = await orderItems.findByIdAndRemove(checkItems._id)
//                 updateQty._doc['qty'] = 0
//                 updateQty._doc['amount'] = 0
//             }
//             else {
//                 updateQty = await orderItems.findByIdAndUpdate(checkItems._id, {
//                     $inc: {
//                         qty: qty, amount: finalAmount
//                     }
//                 }, { new: true })
//             }
//             console.log(finalAmount);
//             let updateItems = await invoiceSchema.findByIdAndUpdate(orderId, {
//                 $inc: {
//                     orderAmount: finalAmount, finalAmount: finalAmount,
//                     pendingAmount: finalAmount
//                 }
//             }, { new: true });
//             updateQty._doc['id'] = updateQty._doc['_id'];
//             delete updateQty._doc.updatedAt;
//             delete updateQty._doc.createdAt;
//             delete updateQty._doc._id;
//             delete updateQty._doc.__v;
//             return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateQty }, message: 'order items updated' });
//         }
//         let addItem = new orderItems({
//             qty: qty,
//             amount: amount,
//             itemId: itemId,
//             categoryId: categoryId,
//             orderId: orderId
//         })
//         await addItem.save();
//         let updateItems = await invoiceSchema.findByIdAndUpdate(orderId, { $inc: { orderAmount: finalAmount } }, { new: true });
//         addItem._doc['id'] = addItem._doc['_id'];
//         delete addItem._doc.updatedAt;
//         delete addItem._doc.createdAt;
//         delete addItem._doc._id;
//         delete addItem._doc.__v;
//         return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addItem }, message: 'order item added' });
//     }
//     catch (error) {
//         return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
//     }
// })
router.post('/addOrderItem', authenticateToken, async (req, res, next) => {
    try {
        const { qty, itemId, categoryId, orderId } = req.body;
        const userId = req.user._id;
        let taxApplied = {}
        let getOrder = await invoiceSchema.findById(orderId);
        if (getOrder == undefined || getOrder == null) {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: 'order details not found' });
        }
        let checkSubscription = await checkUserSubscriptionMember(userId);
        let taxes = await taxSchema.findOne({ isSubscription: checkSubscription[0].isSubscription, isMember: checkSubscription[0].isMember })
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
router.put('/updateOrder', authenticateToken, async (req, res, next) => {
    try {
        const { pickupAddressId, deliveryAddressId, deliveryInstruction, pickupInstruction, status, orderId, paymentId, note, couponId } = req.body;
        const userId = req.user._id;
        let checkOrder = await invoiceSchema.findById(orderId);
        let checkSubscription = await checkUserSubscriptionMember(userId);

        if (checkOrder != undefined && checkOrder != null) {
            if (checkOrder.status == 1 && (couponId != undefined && couponId != null)) {
                console.log("here");
                let checkCoupon = await couponSchema.findById(couponId);
                let amount = checkOrder.finalAmount;
                if (checkCoupon != undefined && checkCoupon != null) {
                    if (checkCoupon.isOnce == true) {
                        let checkCoupon = await invoiceSchema.findOne({ userId: mongoose.Types.ObjectId(checkOrder.userId), couponId: mongoose.Types.ObjectId(couponId), status: { $nin: [11, 0] } });
                        if (checkCoupon != undefined && checkCoupon == null) {
                            return res.status(200).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: 'coupon already used once' });
                        }
                    }
                    if ('percentage' in checkCoupon && checkCoupon.percentage == true) {
                        amount = amount - ((checkCoupon.discount / 100) * amount)
                    }
                    else {
                        amount = amount - checkCoupon.discount;
                    }
                }
                console.log(amount);
                let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, { couponId: couponId, orderTotalAmount: amount, pendingAmount: amount }, { new: true });
                updateOrder._doc['id'] = updateOrder._doc['_id'];
                delete updateOrder._doc.updatedAt;
                delete updateOrder._doc.createdAt;
                delete updateOrder._doc._id;
                delete updateOrder._doc.__v;
                return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateOrder }, message: 'order updated' });

            }
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
router.get('/getOrders', authenticateToken, checkUserRole(['superAdmin', 'admin']), async (req, res) => {
    try {
        const { orderId } = req.query;
        const userId = req.user._id;
        let match;
        let anotherMatch = [];
        // if ('name' in req.query) {
        //     let regEx = new RegExp(req.query.name, 'i')
        //     anotherMatch.push({ name: { $regex: regEx } })
        // }
        anotherMatch.push({ userId: mongoose.Types.ObjectId(userId) })
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
                        }
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
router.get('/getOrdersCount', authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;

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
router.get('/getUserOrders', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.query;
        const userId = req.user._id;
        console.log(userId);
        let match;
        let anotherMatch = [];
        // if ('name' in req.query) {
        //     let regEx = new RegExp(req.query.name, 'i')
        //     anotherMatch.push({ name: { $regex: regEx } })
        // }
        anotherMatch.push({ userId: mongoose.Types.ObjectId(userId) })
        if ('status' in req.query) {
            anotherMatch.push({ status: parseInt(req.query.status) });
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
            { $match: { userId: mongoose.Types.ObjectId(userId) } },
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
                    from: "coupons",
                    let: { couponId: "$couponId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$couponId"] } } }, { $addFields: { id: "$_id" } }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "couponData"
                }
            },
            {
                $lookup: {
                    from: "daywises",
                    let: { deliveryId: "$deliveryTimeId", pickupId: "$pickupTimeId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$deliveryId"] } } }, { $addFields: { id: "$_id" } }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "deliveryTime"
                }
            },
            {
                $lookup: {
                    from: "daywises",
                    let: { pickupId: "$pickupTimeId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$pickupId"] } } }, { $addFields: { id: "$_id" } }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "pickupTime"
                }
            },
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$userId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$userId"] } } }, { $addFields: { id: "$_id" } }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "addresses",
                    let: { addressId: "$pickupAddressId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$addressId"] } } }, { $addFields: { id: "$_id" } }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "pickupAddressData"
                }
            },

            {
                $lookup: {
                    from: "addresses",
                    let: { addressId: "$deliveryAddressId" },
                    pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$addressId"] } } }, { $addFields: { id: "$_id" } }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "deliveryAddressData"
                }
            },
            {
                $addFields: {

                    pickupAddressData: { $first: "$pickupAddressData" },
                    deliveryAddressData: { $first: "$deliveryAddressData" }
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
                        {
                            $group: {
                                _id: "$categoryName",
                                items: { $push: "$$ROOT" }
                            }
                        },
                        {
                            $addFields: {
                                name: "$_id.name",
                                categoryData: "$_id"
                            }
                        },
                        {
                            $project: {
                                _id: 0
                            }
                        }
                    ],
                    as: "orderItems"
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
                    deliveryTime: { $first: "$deliverySlot" },
                    pickupTime: { $first: "$pickupSlot" }
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
        return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: orderId != undefined && getUsers.length > 0 ? getUsers[0] : getUsers }, message: getUsers.length > 0 ? `invoice order found` : "no any invoice orders found" });
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
module.exports = router;