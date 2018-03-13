const moment = require('moment'),
    fs = require('fs'),
    config = require('config'),
    _ = require('lodash'),
    socketio = require('socket.io'),
    Redis = require('ioredis'),
    ffmpeg = require('fluent-ffmpeg');


let redisAddress = config.get('redis_local').address,
    redisClient = new Redis(redisAddress);

redisClient.flushdb();

let modelChat = require('../models/chat'),
    modelRoom = require('../models/room');

class Chat {
    constructor(http) {
        this.io = socketio.listen(http);

        this.userStack = {};
        this.userSocket = {};
        this.lastConnected = '';
        this.videoFileName = '';
        this.sessionExpiration = process.env.session || 180;
    }

    init() {
        this.io.on("connection", socket => {
            let captureDir = '',
                randomNumber = Number(moment());

            /*socket.on("video-stream", data => {
                let username = socket.username;
                this.videoFileName = `${captureDir}/${username}-${randomNumber}.webm`;

                console.log(this.videoFileName);

                let wstream = fs.createWriteStream(this.videoFileName, {encoding: 'ascii', 'flags': 'a'});
                wstream.write(data);
                wstream.end();
            });*/

            socket.on("create-or-join", (username, room_name) => {
                captureDir = `video/${username}`;
                if (!fs.existsSync(captureDir)){
                    fs.mkdirSync(captureDir);
                }

                Promise.all([
                    redisClient.hgetall('userSocket'),
                    redisClient.hgetall('userStack'),
                    redisClient.hget(username, 'connected'),
                    this.getRoomId(room_name)
                ])
                    .then(values => {
                        this.userSocket = values[0];
                        this.userStack = values[1];

                        if(values[2]) {
                            this.lastConnected = values[2];
                        } else {
                            redisClient.hset(username, 'connected', JSON.stringify(Date.now()));
                            this.lastConnected = '';
                        }

                        this.userSocket[username] = socket.id;
                        redisClient.hset('userSocket', username, socket.id);

                        this.userStack[username] = "Online";
                        redisClient.hset('userStack', username, "Online");

                        redisClient.persist(username);

                        let roomId = values[3].roomId,
                            status = values[3].status;
                        if (status === 'old') {
                            socket.join(roomId);
                            socket.username = username;
                            socket.room_name = roomId;
                            let clientsRoom = this.io.sockets.adapter.rooms[roomId].sockets,
                                clients = [];

                            for (let clientId in clientsRoom) {
                                clients.push({
                                    username: this.io.sockets.connected[clientId].username,
                                    id: this.io.sockets.connected[clientId].id
                                });
                            }

                            socket.broadcast.to(socket.room_name).emit("joined", {username: username, id: socket.id});
                            socket.emit("joined", {username: username, data: clients});
                        } else {
                            socket.join(roomId);
                            socket.username = username;
                            socket.room_name = roomId;
                            socket.emit("created", username);
                        }

                        return roomId;
                    })
                    .then(roomId => {
                        if(this.lastConnected) {
                            this.getRoomHistory(roomId)
                                .then(msgs => {
                                    if(msgs) {
                                        this.io.to(socket.id).emit("room-history", {user: username, messages: msgs});
                                    }
                                })
                                .catch(error => {
                                    console.log(error);
                                });
                        }
                    })
                    .catch(error => {
                        console.log(error);
                    });

            });

            socket.on("new-message", data => {
                let msg = data.msg;
                this.setMessage({
                    user: socket.username,
                    msg: msg,
                    room: socket.room_name
                })
                    .then(() => {
                        socket.broadcast.to(socket.room_name).emit("new-message", {
                            username: socket.username,
                            message: msg,
                            msgId: data.id
                        });
                    })
                    .catch(error => {
                        console.log(error);
                    });

            });

            socket.on('typing', () => {
                socket.broadcast.to(socket.room_name).emit("set-typing");
            });

            socket.on('delivered', data => {
                socket.broadcast.to(socket.room_name).emit("set-delivered", data);
            });

            socket.on('seen', data => {
                socket.broadcast.to(socket.room_name).emit("set-seen", data);
            });

            socket.on("disconnect", () => {
                let username = socket.username;

                socket.broadcast.to(socket.room_name).emit("left", {username: username, id: socket.id});

                _.unset(this.userSocket, username);
                this.userStack[username] = "Offline";

                redisClient.hdel('userSocket', username);
                redisClient.hset('userStack', username, "Offline");

                redisClient.expire(username, this.sessionExpiration);

                /*if(typeof username !== 'undefined') {
                    let ffmpegCmd = ffmpeg(this.videoFileName);
                    ffmpegCmd
                        .on('error', err => {
                            console.log('An error occurred: ' + err.message);
                        })
                        .on('end', () => {
                            if (fs.statSync(this.videoFileName).isFile())
                                fs.unlinkSync(this.videoFileName);
                            console.log('Processing finished !');
                        })
                        .fps(12)
                        .save(`video/${username}.webm`);
                }*/
            });

            socket.on("video-call-request", id => {
                socket.to(id).emit("video-call", {
                    username: socket.username,
                    id: socket.id
                });
            });

            socket.on("approved-video", id => {
                let room = this.randomToken();
                socket.to(id).emit("video-call-approved", room);
                socket.emit("video-call-approved", room);
            });

            socket.on("denied-video", (id, message) => {
                message === "not compatible"
                    ? socket.to(id).emit("not-compatible", socket.username)
                    : socket.to(id).emit("video-call-denied", socket.username);
            });

            socket.on("create-or-join-video", (username, video_room) => {
                let exist = false,
                    numClients;
                if (typeof this.io.of('/').adapter.rooms[video_room] !== 'undefined') {
                    numClients = this.io.of('/').adapter.rooms[video_room].length;
                    exist = true;
                }

                if (!exist) {
                    socket.video_room = video_room;
                    socket.join(video_room);
                    socket.emit("created-video-room", video_room);
                } else if (numClients === 1) {
                    socket.broadcast.to(video_room).emit("join-video-room", video_room);
                    socket.video_room = video_room;
                    socket.join(video_room);
                    socket.emit("joined-video-room", video_room);
                } else {
                    socket.emit("full");
                }
            });

            socket.on('message', message => {
                socket.broadcast.to(socket.video_room).emit('message', message);
            });

        });

        return this.io;
    };

    randomToken() {
        return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
    };

    getRoomId(room) {
        return new Promise((resolve, reject) => {
            let newRoom = new modelRoom();
            newRoom
                .query(qb => {
                    qb.where('name', '=', room);
                })
                .fetch()
                .then(model => {
                    if (!model) {
                        newRoom
                            .save({
                                name: room
                            })
                            .then(model => {
                                resolve({roomId: model.toJSON().id, status: 'new'});
                            })
                            .catch(error => {
                                reject(error);
                            })
                    } else {
                        resolve({roomId: model.toJSON().id, status: 'old'});
                    }
                })
                .catch(error => {
                    reject(error);
                });
        });
    };

    setMessage(data) {
        return new Promise((resolve, reject) => {
            new modelChat()
                .save({
                    user: data.user,
                    msg: data.msg,
                    room: data.room
                })
                .then(model => {
                    resolve(model.toJSON());
                })
                .catch(error => {
                    reject(error);
                });
        });
    };

    getRoomHistory(roomId) {
        return new Promise((resolve, reject) => {
            let chats = new modelChat(),
                lastConnected = moment(Number(this.lastConnected)).format("YYYY-MM-DD HH:mm:ss Z");
            chats
                .query('orderBy', 'created_at', 'asc')
                .query('limit', '100')
                .query(qb => {
                    qb.where('room', '=', roomId)
                        .andWhere('created_at', '>', lastConnected)
                })
                .fetchAll()
                .then(data => {
                    resolve(data.toJSON());
                })
                .catch(error => {
                    reject(error);
                });
        })
    };
}

module.exports = Chat;