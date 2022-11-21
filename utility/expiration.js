const membershipSchema = require("../models/membershipSchema");
const userModel = require("../models/userModel");
const userSubscription = require("../models/userSubscription");
const mongoose = require('mongoose')
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
            console.log(update);
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
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
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
    console.log(checkUser);
    if (checkUser.length > 0) {
        return checkUser;
    }
    return [{ isSubscription: false, isMember: false }]
}