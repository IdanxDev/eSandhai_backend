module.exports = function (io) {
    // io.use((socket, next) => {
    //     const token = socket.handshake.auth.token;
    //     console.log(token);
    //     console.log("here");
    //     if (!token) {
    //         next(new Error("invalid"));
    //     }
    //     if (token == 'cf198546f1c8891b5e91c749b87387e5fef897f8bf8b2cfdfe05f429fe68cbac353b7535397049f39a6f372be972a679cf538492aa3321bc3960cdb56ff4fb63') {
    //         next();
    //     }

    // });

    io.of('/connection').use((socket, next) => {
        const token = socket.handshake.auth.token;
        console.log(token);
        console.log("here");
        if (!token) {
            next(new Error("invalid"));
        }
        if (token == 'cf198546f1c8891b5e91c749b87387e5fef897f8bf8b2cfdfe05f429fe68cbac353b7535397049f39a6f372be972a679cf538492aa3321bc3960cdb56ff4fb63') {
            next();
        }

    }).on('connection', function (socket) {
        console.log('A user connected');
        console.log(socket.id);
        setInterval(function () {
            // do your thing
            socket.emit("requestLocation");
        }, 2000);
        io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            console.log("here");
            // ...
        });
        socket.on('getLocation', function (arg, callback) {
            callback({
                "issuccess": true,
                "data": {
                    "acknowledgement": true,
                    "data": {
                        "pickup": {
                            "startCordinates": [
                                [
                                    40.61315411446906,
                                    -73.97547857082478
                                ]
                            ],
                            "endCordinates": [
                                [
                                    40.63847258322205,
                                    -73.9320454684705
                                ]
                            ],
                            "trackCordinates": [
                                [
                                    40.62277916233447,
                                    -73.97110236270126
                                ],
                                [
                                    40.62624749200573,
                                    -73.9583964810476
                                ],
                                [
                                    40.63141927532503,
                                    -73.94336350527279
                                ]
                            ]
                        },
                        "deliver": {
                            "startCordinates": [
                                [
                                    40.61315411446906,
                                    -73.97547857082478
                                ]
                            ],
                            "endCordinates": [
                                [
                                    40.63847258322205,
                                    -73.9320454684705
                                ]
                            ],
                            "trackCordinates": [
                                [
                                    40.62277916233447,
                                    -73.97110236270126
                                ],
                                [
                                    40.62624749200573,
                                    -73.9583964810476
                                ],
                                [
                                    40.63141927532503,
                                    -73.94336350527279
                                ]
                            ]
                        },
                        "return": {
                            "startCordinates": [
                                [
                                    40.61315411446906,
                                    -73.97547857082478
                                ]
                            ],
                            "endCordinates": [
                                [
                                    40.63847258322205,
                                    -73.9320454684705
                                ]
                            ],
                            "trackCordinates": [
                                [
                                    40.62277916233447,
                                    -73.97110236270126
                                ],
                                [
                                    40.62624749200573,
                                    -73.9583964810476
                                ],
                                [
                                    40.63141927532503,
                                    -73.94336350527279
                                ]
                            ]
                        }
                    }
                },
                "message": "data found"
            })
        });
        //Whenever someone disconnects this piece of code executed
        socket.on('disconnect', function () {
            console.log('A user disconnected');
        });
    });
}