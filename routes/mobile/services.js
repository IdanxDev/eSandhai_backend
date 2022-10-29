var express = require('express');
var router = express.Router();
const { generateAccessToken, authenticateToken, generateRefreshToken } = require('../../middleware/auth');
const categorySchema = require('../../models/categorySchema');
const helperSchema = require('../../models/helperSchema');
const itemSchema = require('../../models/itemSchema');
const subscriptionSchema = require('../../models/subscriptionSchema');
router.get('/getDetails', async (req, res, next) => {
    try {
        const { status } = req.query;
        const terms = `Lacus tincidunt ac lacinia, malesuada facilisi? Feugiat convallis iaculis pulvinar quam lacinia nibh in varius viverra. Penatibus maecenas mollis risus gravida class dis pellentesque nibh magna eget porta auctor? Phasellus libero tortor mauris molestie at elementum lacinia nostra. Accumsan amet, quisque rhoncus! Vitae parturient dolor nam nascetur? Etiam, himenaeos taciti.

Ridiculus lacus magnis lacinia risus platea. Vulputate tempus, varius purus convallis leo. Dictum congue diam consequat facilisi. Malesuada magna, sem sapien curabitur magnis donec facilisis interdum sociosqu felis luctus quam. Ante quis montes malesuada, fames tellus. Lorem iaculis inceptos fames natoque scelerisque montes lobortis nam taciti eget? Sem vulputate magna gravida faucibus tempor venenatis tincidunt rhoncus. Risus amet nisi risus. Eros risus!

Mollis per malesuada duis lectus. Viverra aptent tellus cubilia facilisi cubilia dictum? Quisque cursus orci in viverra venenatis ac varius leo nibh. Imperdiet sodales, tempor rhoncus laoreet commodo sit amet. Malesuada orci velit congue turpis donec justo elit? Euismod eget lacus scelerisque suscipit lectus, eget mus. Metus, nostra sem interdum eget suspendisse conubia blandit nullam magna volutpat! Senectus senectus vivamus curabitur. Sollicitudin semper litora eros tincidunt donec sed varius himenaeos condimentum accumsan. Pulvinar aenean aptent quisque arcu.

Vehicula blandit et nunc habitasse risus class tempor curabitur sollicitudin elit? Lectus vehicula nec quis elementum sociis rutrum fusce nunc euismod, sociis maecenas fames. A magnis magnis mauris posuere pretium justo senectus odio iaculis primis turpis. Sodales ante commodo pharetra neque. Dictumst enim, urna tellus enim lacus suscipit ultrices. Inceptos curae; dictumst aliquet cras pulvinar euismod cubilia. Elementum cras venenatis id! Elit tempor est enim ornare eget. Odio vitae phasellus libero? Vestibulum, praesent eleifend nisl vehicula. Sit aptent?

Faucibus aptent lectus dapibus nascetur fames ipsum fusce pretium ultricies facilisis. Nam lorem nascetur nisl gravida lectus morbi ullamcorper. Cubilia penatibus justo accumsan et dis malesuada. Tortor vulputate risus cum duis natoque? Porttitor tempor habitasse, ac nisl? Ornare donec primis euismod penatibus ridiculus natoque habitasse. Sociosqu cum lacus quisque ac, eleifend tristique.
`;
        const privacy = `Lacus tincidunt ac lacinia, malesuada facilisi? Feugiat convallis iaculis pulvinar quam lacinia nibh in varius viverra. Penatibus maecenas mollis risus gravida class dis pellentesque nibh magna eget porta auctor? Phasellus libero tortor mauris molestie at elementum lacinia nostra. Accumsan amet, quisque rhoncus! Vitae parturient dolor nam nascetur? Etiam, himenaeos taciti.

Ridiculus lacus magnis lacinia risus platea. Vulputate tempus, varius purus convallis leo. Dictum congue diam consequat facilisi. Malesuada magna, sem sapien curabitur magnis donec facilisis interdum sociosqu felis luctus quam. Ante quis montes malesuada, fames tellus. Lorem iaculis inceptos fames natoque scelerisque montes lobortis nam taciti eget? Sem vulputate magna gravida faucibus tempor venenatis tincidunt rhoncus. Risus amet nisi risus. Eros risus!

Mollis per malesuada duis lectus. Viverra aptent tellus cubilia facilisi cubilia dictum? Quisque cursus orci in viverra venenatis ac varius leo nibh. Imperdiet sodales, tempor rhoncus laoreet commodo sit amet. Malesuada orci velit congue turpis donec justo elit? Euismod eget lacus scelerisque suscipit lectus, eget mus. Metus, nostra sem interdum eget suspendisse conubia blandit nullam magna volutpat! Senectus senectus vivamus curabitur. Sollicitudin semper litora eros tincidunt donec sed varius himenaeos condimentum accumsan. Pulvinar aenean aptent quisque arcu.

Vehicula blandit et nunc habitasse risus class tempor curabitur sollicitudin elit? Lectus vehicula nec quis elementum sociis rutrum fusce nunc euismod, sociis maecenas fames. A magnis magnis mauris posuere pretium justo senectus odio iaculis primis turpis. Sodales ante commodo pharetra neque. Dictumst enim, urna tellus enim lacus suscipit ultrices. Inceptos curae; dictumst aliquet cras pulvinar euismod cubilia. Elementum cras venenatis id! Elit tempor est enim ornare eget. Odio vitae phasellus libero? Vestibulum, praesent eleifend nisl vehicula. Sit aptent?

Faucibus aptent lectus dapibus nascetur fames ipsum fusce pretium ultricies facilisis. Nam lorem nascetur nisl gravida lectus morbi ullamcorper. Cubilia penatibus justo accumsan et dis malesuada. Tortor vulputate risus cum duis natoque? Porttitor tempor habitasse, ac nisl? Ornare donec primis euismod penatibus ridiculus natoque habitasse. Sociosqu cum lacus quisque ac, eleifend tristique.
`;
        const about = `Lacus tincidunt ac lacinia, malesuada facilisi? Feugiat convallis iaculis pulvinar quam lacinia nibh in varius viverra. Penatibus maecenas mollis risus gravida class dis pellentesque nibh magna eget porta auctor? Phasellus libero tortor mauris molestie at elementum lacinia nostra. Accumsan amet, quisque rhoncus! Vitae parturient dolor nam nascetur? Etiam, himenaeos taciti.

Ridiculus lacus magnis lacinia risus platea. Vulputate tempus, varius purus convallis leo. Dictum congue diam consequat facilisi. Malesuada magna, sem sapien curabitur magnis donec facilisis interdum sociosqu felis luctus quam. Ante quis montes malesuada, fames tellus. Lorem iaculis inceptos fames natoque scelerisque montes lobortis nam taciti eget? Sem vulputate magna gravida faucibus tempor venenatis tincidunt rhoncus. Risus amet nisi risus. Eros risus!

Mollis per malesuada duis lectus. Viverra aptent tellus cubilia facilisi cubilia dictum? Quisque cursus orci in viverra venenatis ac varius leo nibh. Imperdiet sodales, tempor rhoncus laoreet commodo sit amet. Malesuada orci velit congue turpis donec justo elit? Euismod eget lacus scelerisque suscipit lectus, eget mus. Metus, nostra sem interdum eget suspendisse conubia blandit nullam magna volutpat! Senectus senectus vivamus curabitur. Sollicitudin semper litora eros tincidunt donec sed varius himenaeos condimentum accumsan. Pulvinar aenean aptent quisque arcu.

Vehicula blandit et nunc habitasse risus class tempor curabitur sollicitudin elit? Lectus vehicula nec quis elementum sociis rutrum fusce nunc euismod, sociis maecenas fames. A magnis magnis mauris posuere pretium justo senectus odio iaculis primis turpis. Sodales ante commodo pharetra neque. Dictumst enim, urna tellus enim lacus suscipit ultrices. Inceptos curae; dictumst aliquet cras pulvinar euismod cubilia. Elementum cras venenatis id! Elit tempor est enim ornare eget. Odio vitae phasellus libero? Vestibulum, praesent eleifend nisl vehicula. Sit aptent?

Faucibus aptent lectus dapibus nascetur fames ipsum fusce pretium ultricies facilisis. Nam lorem nascetur nisl gravida lectus morbi ullamcorper. Cubilia penatibus justo accumsan et dis malesuada. Tortor vulputate risus cum duis natoque? Porttitor tempor habitasse, ac nisl? Ornare donec primis euismod penatibus ridiculus natoque habitasse. Sociosqu cum lacus quisque ac, eleifend tristique.
`;

        if (status == 0) {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: terms }, message: "details found" });
        }
        else if (status == 1) {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: privacy }, message: "details found" });
        }
        else if (status == 2) {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: about }, message: "details found" });
        }
        else {
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { terms: terms, privacy: privacy, about: about } }, message: "details found" });
        }
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
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
        anotherMatch.push({ isVisible: true })
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
        return res.status(getUsers.length > 0 ? 200 : 200).json({ issuccess: getUsers.length > 0 ? true : false, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `category found` : "no category found" });
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
        anotherMatch.push({ isVisible: true })
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
        return res.status(getUsers.length > 0 ? 200 : 200).json({ issuccess: getUsers.length > 0 ? true : false, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `category items found` : "no category item found" });
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
        anotherMatch.push({ isVisible: true })
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
        return res.status(getUsers.length > 0 ? 200 : 200).json({ issuccess: getUsers.length > 0 ? true : false, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `category helper found` : "no category helper found" });
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
        return res.status(getUsers.length > 0 ? 200 : 200).json({ issuccess: getUsers.length > 0 ? true : false, data: { acknowledgement: getUsers.length > 0 ? true : false, data: getUsers }, message: getUsers.length > 0 ? `subscription found` : "no subscription plan found" });
    } catch (error) {
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
})
module.exports = router;