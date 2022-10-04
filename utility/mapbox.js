var axios = require('axios');

exports.getPlaces = (keyword, limit) => {
    var config = {
        method: 'get',
        url: `https://api.mapbox.com/geocoding/v5/mapbox.places/${keyword}.json?country=us&limit=${limit}&types=place%2Cpostcode%2Caddress%2Ccountry%2Cregion%2Cdistrict%2Clocality%2Cneighborhood%2Cpoi&language=en&access_token=pk.eyJ1IjoiYWJjNjM0MSIsImEiOiJjbDhwcnJ1cTAxMnA4M29saDdsODBpczg3In0.0eoXEiEwz3mWpLD5YvPAwQ`,
        headers: {}
    };

    return new Promise((resolve, reject) => {
        axios(config)
            .then(function (response) {
                resolve(response.data)
            })
            .catch(function (error) {
                reject(error)
                console.log(error);
            });
    });
}
exports.placeFilter = (data) => {
    if ('features' in data && data.features.length > 0) {
        let array = data.features.map(v => ({ title: v.text_en, placeName: v.place_name_en, lat: ('geometry' in v && 'coordinates' in v.geometry) ? v.geometry.coordinates[1] : "", long: ('geometry' in v && 'coordinates' in v.geometry) ? v.geometry.coordinates[0] : "" }));
        return array;
    }
    return [];
}
exports.formatAddress = (data) => {
    if ('features' in data && data.features.length > 0 && 'text_en' in data.features[0] && 'place_name_en' in data.features[0] && 'context' in data.features[0]) {
        let address = {
            placeName: data.features[0].text_en,
            placeAddress: data.features[0].place_name_en
        }
        if ('geometry' in data.features[0] && 'coordinates' in data.features[0].geometry) {
            address = Object.assign(address, { lat: data.features[0].geometry.coordinates[1], long: data.features[0].geometry.coordinates[0] })
        }

        if (data.features[0].context.length > 0) {
            let keys = ["landmark", "pincode", "locality", "city", "district", "region", "country"]
            console.log(keys.length + "  " + data.features[0].context.length);
            const obj = {};
            let fields = data.features[0].context.map((e) => e.text_en)
            keys.forEach((element, index) => {
                obj[element] = fields[index];
            });
            address = Object.assign(address, obj)
        };
        return address
    }
    return {};
}