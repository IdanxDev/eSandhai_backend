var express = require('express');
var router = express.Router();
const { generateAccessToken, authenticateToken, generateRefreshToken } = require('../../middleware/auth');
const categorySchema = require('../../models/categorySchema');
const helperSchema = require('../../models/helperSchema');
const itemSchema = require('../../models/itemSchema');
const subscriptionSchema = require('../../models/subscriptionSchema');
router.get('/getCategory', authenticateToken, async (req, res) => {
    try {
        let match;
        let anotherMatch = [];
        console.log(Boolean(req.query.isVisible));
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('isVisible' in req.query) {
            anotherMatch.push({ isVisible: req.query.isVisible === 'true' })
        }
        if ('isSubscription' in req.query) {
            anotherMatch.push({ isSubscription: req.query.isSubscription === 'true' })
        }
        if ('description' in req.query) {
            let regEx = new RegExp(req.query.description, 'i')
            anotherMatch.push({ description: { $regex: regEx } })
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
        let getUsers = await categorySchema.aggregate([
            match,
            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $lookup: {
                    from: "helpers",
                    let: { id: "$_id" },
                    pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$categoryId", "$$id"] }, { $eq: ["$isVisible", true] }] } } },
                    {
                        $addFields: {
                            "id": "$_id"
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            __v: 0,
                            isVisible: 0
                        }
                    }],
                    as: "helperData"
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0
                }
            }
        ])
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: getUsers.length > 0 ? true : false, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `category found` : "no category found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getItems', authenticateToken, async (req, res) => {
    try {
        let match;
        let anotherMatch = [];
        if ('name' in req.query) {
            let regEx = new RegExp(req.query.name, 'i')
            anotherMatch.push({ name: { $regex: regEx } })
        }
        if ('isVisible' in req.query) {
            anotherMatch.push({ isVisible: req.query.isVisible === 'true' })
        }
        if ('description' in req.query) {
            let regEx = new RegExp(req.query.description, 'i')
            anotherMatch.push({ description: { $regex: regEx } })
        }
        if ('categoryId' in req.query) {
            anotherMatch.push({ categoryId: mongoose.Types.ObjectId(req.query.categoryId) })
        }
        if ('isBag' in req.query) {
            anotherMatch.push({ isBag: req.query.isBag === 'true' })
        }
        if ('priceTag' in req.query) {
            let regEx = new RegExp(req.query.priceTag, 'i')
            anotherMatch.push({ priceTag: { $regex: regEx } })
        }
        if ('itemId' in req.query) {
            anotherMatch.push({ _id: mongoose.Types.ObjectId(req.query.itemId) })
        }
        if ('mrpStart' in req.query == true && 'mrpEnd' in req.query == true) {
            anotherMatch.push({ $and: [{ mrp: { "$gte": parseFloat(req.query.mrpStart) } }, { mrp: { "$lte": parseFloat(req.query.mrpEnd) } }] });
        }
        if ('discountStart' in req.query == true && 'discountEnd' in req.query == true) {
            anotherMatch.push({ $and: [{ discount: { "$gte": parseFloat(req.query.discountStart) } }, { discount: { "$lte": parseFloat(req.query.discountEnd) } }] });
        }
        if ('priceStart' in req.query == true && 'priceEnd' in req.query == true) {
            anotherMatch.push({ $and: [{ price: { "$gte": parseFloat(req.query.priceStart) } }, { price: { "$lte": parseFloat(req.query.priceEnd) } }] });
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
        let getUsers = await itemSchema.aggregate([
            match,
            {
                $addFields: {
                    "id": "$_id"
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "categoryId",
                    foreignField: "_id",
                    as: "categoryData"
                }
            },
            {
                $addFields: {
                    categoryName: {
                        $cond: {
                            if: { $gt: [{ $size: "$categoryData" }, 0] }, then: { $first: "$categoryData.name" }, else: ""
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0,
                    categoryData: 0
                }
            }
        ])
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: getUsers.length > 0 ? true : false, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `category items found` : "no category item found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
router.get('/getHelper', authenticateToken, async (req, res) => {
    try {
        let match;
        let anotherMatch = [];
        if ('title' in req.query) {
            let regEx = new RegExp(req.query.title, 'i')
            anotherMatch.push({ title: { $regex: regEx } })
        }
        if ('isVisible' in req.query) {
            anotherMatch.push({ isVisible: req.query.isVisible === 'true' })
        }
        if ('description' in req.query) {
            let regEx = new RegExp(req.query.description, 'i')
            anotherMatch.push({ description: { $regex: regEx } })
        }
        if ('categoryId' in req.query) {
            anotherMatch.push({ categoryId: mongoose.Types.ObjectId(req.query.categoryId) })
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
        let getUsers = await helperSchema.aggregate([
            match,
            {
                $addFields: {
                    "id": "$_id"
                }
            },

            {
                $lookup: {
                    from: "categories",
                    localField: "categoryId",
                    foreignField: "_id",
                    as: "categoryData"
                }
            },
            {
                $addFields: {
                    categoryName: {
                        $cond: {
                            if: { $gt: [{ $size: "$categoryData" }, 0] }, then: { $first: "$categoryData.name" }, else: ""
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    __v: 0,
                    categoryData: 0
                }
            }
        ])
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: getUsers.length > 0 ? true : false, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `category helper found` : "no category helper found" });
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
        return res.status(getUsers.length > 0 ? 200 : 404).json({ issuccess: getUsers.length > 0 ? true : false, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `subscription found` : "no subscription plan found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
module.exports = router;