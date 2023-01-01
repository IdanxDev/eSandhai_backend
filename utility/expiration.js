const membershipSchema = require("../models/membershipSchema");
const userModel = require("../models/userModel");
const userSubscription = require("../models/userSubscription");
const mongoose = require('mongoose');
const dayWiseSchema = require("../models/dayWiseSchema");
const timeSchema = require("../models/timeSchema");
const holidaySchema = require("../models/holidaySchema");

const moment = require('moment');
exports.checkExpireSubscription = async () => {
    let checkExpire = await userSubscription.aggregate([
        {
            $match: {
                endDate: { $lte: new Date() }
            }
        }
    ]);
    if (checkExpire.length > 0) {
        for (i = 0; i < checkExpire.length > 0; i++) {
            await userSubscription.findByIdAndUpdate(checkExpire[i]._id, { status: 2 }, { new: true })
        }
    }
    let getAddressIs = await userSubscription.aggregate([
        {
            $addFields: {
                usedDays:
                {
                    $dateDiff:
                    {
                        startDate: "$startDate",
                        endDate: new Date(),
                        unit: "day"
                    }
                },
                pendingDays:
                {
                    $dateDiff:
                    {
                        startDate: new Date(),
                        endDate: "$endDate",
                        unit: "day"
                    }
                }
            }
        }
    ])
    // console.log(getAddressIs)
    if (getAddressIs.length > 0) {
        for (i = 0; i < getAddressIs.length > 0; i++) {
            let update = await userSubscription.findByIdAndUpdate(getAddressIs[i]._id, { pendingDays: getAddressIs[i].pendingDays, usedDays: getAddressIs[i].usedDays }, { new: true });
            // console.log(update);
        }
    }
}
exports.checkExpireMemberShip = async () => {
    let checkExpire = await membershipSchema.aggregate([
        {
            $match: {
                endDate: { $lte: new Date() }
            }
        }
    ]);
    if (checkExpire.length > 0) {
        for (i = 0; i < checkExpire.length > 0; i++) {
            await membershipSchema.findByIdAndUpdate(checkExpire[i]._id, { status: 2 }, { new: true })
        }
    }
    let getAddressIs = await membershipSchema.aggregate([
        {
            $addFields: {
                usedDays:
                {
                    $dateDiff:
                    {
                        startDate: "$startDate",
                        endDate: new Date(),
                        unit: "day"
                    }
                },
                pendingDays:
                {
                    $dateDiff:
                    {
                        startDate: new Date(),
                        endDate: "$endDate",
                        unit: "day"
                    }
                }
            }
        }
    ])
    // console.log(getAddressIs)
    if (getAddressIs.length > 0) {
        for (i = 0; i < getAddressIs.length > 0; i++) {
            let update = await membershipSchema.findByIdAndUpdate(getAddressIs[i]._id, { pendingDays: getAddressIs[i].pendingDays, usedDays: getAddressIs[i].usedDays }, { new: true });
            console.log(update);
        }
    }
}
exports.getDateArray = (start, end) => {
    var arr = new Array();
    var dt = new Date(start);
    while (dt <= end) {
        arr.push(`${new Date(dt).getDate()}/${new Date(dt).getMonth() + 1}/${new Date(dt).getFullYear()}`);
        if (new Date(dt).getDate().toString().length == 1) {
            arr.push(`0${new Date(dt).getDate()}/${new Date(dt).getMonth() + 1}/${new Date(dt).getFullYear()}`);
        }
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
}
exports.getNextDays = (start) => {
    var arr = new Array();
    var dt = new Date(start);
    for (i = 0; i < 7; i++) {
        arr.push(`${new Date(dt).getDate()}/${new Date(dt).getMonth() + 1}/${new Date(dt).getFullYear()}`);
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
}
exports.nextDays = async (start) => {
    let currentDate = moment()
        .tz('America/Panama')
        .format("DD/MM/YYYY");
    let next = start;
    let array = []
    for (i = 0; i < 7; i++) {
        if (i != 0) {
            next = moment(next)
                .tz('America/Panama').add(1, 'days')
        }
        let nextDate = next.format("DD/MM/YYYY");
        array.push(nextDate)
        let getHoliday = await holidaySchema.findOne({ date: nextDate });
        if (getHoliday != null && getHoliday != undefined) {
            let checkExist = await dayWiseSchema.aggregate([{ $match: { date: nextDate } }]);
            if (checkExist.length > 0) {
                // return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkExist[0] }, message: `${date} status found` });
            }
            else {
                for (i = 0; i < getHoliday.timeSlots.length; i++) {
                    await new dayWiseSchema({ date: nextDate, timeSlotId: getHoliday.timeSlots[i].timerangeId, timeSlot: getHoliday.timeSlots[i].timeSlot, isActive: getHoliday.timeSlots[i].isActive, isHalfHoliday: getHoliday.isHalfHoliday, isFullHoliday: getHoliday.isFullHoliday }).save();
                }
            }
            // return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addDay }, message: `${date} status found` });
        }
        let checkExist = await dayWiseSchema.aggregate([{ $match: { date: nextDate } }]);
        if (checkExist.length > 0) {
            // return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkExist[0] }, message: `${date} status found` });
        }
        else {
            let getTimeRange = await timeSchema.aggregate([{ $addFields: { isActive: true, time: { $concat: ["$start", " - ", "$end"] } } }]);
            for (i = 0; i < getTimeRange.length; i++) {
                await new dayWiseSchema({ date: nextDate, timeSlotId: getTimeRange[i]._id, timeSlot: getTimeRange[i].time, isActive: getTimeRange[i].isActive, isHalfHoliday: false, isFullHoliday: false }).save();
            }
        }
    }
    return array;
}
exports.getNextNextDays = (start) => {
    var arr = new Array();
    var dt = new Date(start);
    for (i = 0; i < 7; i++) {
        arr.push(`${new Date(dt).getDate()}/${new Date(dt).getMonth() + 1}/${new Date(dt).getFullYear()}`);
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
}
exports.getStatus = (status) => {
    switch (status) {
        case 0:
            return "Item Selection"
            // code block
            break;
        case 1:
            return "Pending Payment"
            // code block
            break;
        case 2:
            return "Pending Pickup"
            break;
        case 3:
            return "Pickup Initiated"
            break;
        case 4:
            return "Pickup Failed"
            break;
        case 5:
            return "Pickup Completed"
            break;
        case 6:
            return "Processing Your Clothes"
            break;
        case 7:
            return "Cleaning Completed"
            break;
        case 8:
            return "Delivery Initiated"
            break;
        case 9:
            return "Pickup Failed"
            break;
        case 10:
            return "Order Completed"
            break;
        case 11:
            return "Order Cancelled"
            break;
        case 12:
            return "Order Cancelled And Refund Pending"
            break;
        case 13:
            return "Refund Processed"
            break;
        default:
            return "No any order status found"
        // code block
    }
}
exports.checkUserSubscriptionMember = async (userId) => {
    let checkUser = await userModel.aggregate([{ $match: { _id: mongoose.Types.ObjectId(userId) } }, {
        $lookup: {
            from: "memberships",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", 1] }] } } }],
            as: "membershipDetail"
        }
    },
    {
        $lookup: {
            from: "usersubsciptions",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", 1] }] } } }],
            as: "subscriptionDetail"
        }
    },
    {
        $project: {
            isSubscription: {
                $cond: { if: { $gte: [{ $size: "$subscriptionDetail" }, 1] }, then: true, else: false }
            },
            isMember: {
                $cond: { if: { $gte: [{ $size: "$membershipDetail" }, 1] }, then: true, else: false }
            }
        }
    }])
    if (checkUser.length > 0) {
        // checkUser[0]['isSubscription'] = false
        return checkUser;
    }
    return [{ isSubscription: false, isMember: false }]
}
exports.getUserMembershipSubscription = async (userId) => {
    let checkUser = await userModel.aggregate([{ $match: { _id: mongoose.Types.ObjectId(userId) } }, {
        $lookup: {
            from: "memberships",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", 1] }] } } },
            {
                $lookup: {
                    from: "membershipdetails",
                    localField: "membershipId",
                    foreignField: "_id",
                    as: "membershipData"
                }
            }],
            as: "membershipDetail"
        }
    },
    {
        $lookup: {
            from: "usersubsciptions",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", 1] }] } } }, {
                $lookup: {
                    from: "subscriptions",
                    localField: "planId",
                    foreignField: "_id",
                    as: "subscriptionData"
                }
            }],
            as: "subscriptionDetail"
        }
    }])
    if (checkUser.length > 0) {
        return checkUser[0];
    }
    return { membershipDetail: [], subscriptionDetail: [] }
}