let $button = $('#but'),
    $button2 = $('#hang-up'),
    $window = $(document),

    $login_page = $('.login_page'),
    $room_name = $('#room_name'),
    $username = $('#username'),

    $chatPage = $('.chat_page'),
    $chat_body = $('.chat-body'),
    $chat_users = $('.chat-users'),
    $inputMessage = $('.input-message'),
    $videoOffer = $("#video-offer"),
    socket = io(),

    myId,
    connected = false,
    inactive = false,
    room,
    hasNewMessage = false,
    lastMessageId;

let getUserMedia = navigator.getUserMedia ||
                    navigator.webkitGetUserMedia ||
                    navigator.mozGetUserMedia ||
                    navigator.msGetUserMedia;

function log(message) {
    let $el = $('<div class="log">').text(message);
    addMessageElement($el);
}

function addUsername(main_data) {
    let username,
        usernameDiv;
    if (main_data[0]) {
        for (let i in main_data) {
            if (main_data[i].id !== myId) {
                username = $("<p class='name'>").text(main_data[i].username).attr("id", main_data[i].id);
                usernameDiv = $("<div class='user'>").append(username);
                usernameDiv.click(function () {
                    getUserMedia
                        ? socket.emit("video-call-request", this.firstChild.id)
                        : alert("Browser is not compatible.");
                });
                $chat_users.append(usernameDiv);
            }
        }
    } else {
        username = $("<p class='name'>").text(main_data.username).attr("id", main_data.id);
        usernameDiv = $("<div class='user'>").append(username);
        usernameDiv.click(() => {
            socket.emit("video-call-request", main_data.id);
        });
        $chat_users.append(usernameDiv);
    }
}

function sendMessage() {
    let message = $inputMessage.val();
    if (message && connected) {
        let id = (+new Date).toString(36);
        socket.emit("new-message", {msg: message, id: id});
        $inputMessage.val("");
        addOutgoingMessage(message, id);
    }
}

function addIncomeMessage(data) {
    let $usernameDiv = $("<div class='name' id='chat_user'/>")
        .text(data.username);
    let $messageBody = $('<div class="text">')
        .text(data.message);
    let $messageDiv = $('<div class="answer left"/>')
        .append($messageBody, $usernameDiv).attr("id", "msg" + data.msgId);
    addMessageElement($messageDiv);
}

function fillMessageHistory(data) {
    let msgs = data.messages,
        username = data.user;
    for(let i = 0; i < msgs.length; i++) {
        let msg = msgs[i];
        if(msg.user === username) {
            addOutgoingMessage(msg.msg);
        } else {
            let item = {
                username: msg.user,
                message: msg.msg
            };
            addIncomeMessage(item);
        }
    }
}

function addMessageElement(el) {
    let $el = $(el);
    $chat_body.append($el);
}

function addOutgoingMessage(message, msgId) {
    let $delivered = $('<div class="msg-delivered">');
    let $messageBody = $('<div class="text">')
        .text(message);
    let $messageDiv = $('<div class="answer right"/>')
        .append($messageBody)
        .append($delivered).attr("id", "msg" + msgId);
    addMessageElement($messageDiv);
}

function connectRoom(username, room_name) {
    socket.emit("create-or-join", username, room_name);
}

function disconnectRoom() {
    window.location.reload();
}

// Keyboard Events

$window.keydown(event => {
    if (!(event.ctrlKey || event.metaKey || event.altKey) && $chatPage.is(":visible")) {
        $inputMessage.focus();
    }
    if (event.which === 13) {
        let room_name = $room_name.val(),
            username = $username.val();

        if ($chatPage.is(":visible")) {
            sendMessage();
        } else if (username && room_name) {
            connectRoom(username, room_name);
        } else if (!username || !room_name) {
            $(".error").text("Missing: Username or Room Name").show();
        }
        $room_name.val("");
        $username.val("");
    }
});

$("#my-msg").keyup(() => {
    if ($("#my-msg").val()) {
        socket.emit("typing");
    }
});

socket.on("set-typing", () => {
    let setTime;
    clearTimeout(setTime);
    $("#typing").text("is typing ...");
    setTime = setTimeout(() => {
        $("#typing").text("");
    }, 3000);
});

socket.on("set-seen", data => {
    let chatDate = moment(data.date).format("hh:mm:ss a");
    $("#msg-status").html("Seen " + chatDate);
});

$(window).focus(() => {
    if(hasNewMessage) {
        socket.emit("seen", lastMessageId);
        hasNewMessage = false;
    }
});

socket.on("set-delivered", data => {
    $("#msg" + data + " .msg-delivered").css("background-color", "green");
});

socket.on("created", username => {
    connected = true;
    myId = socket.id;
    $login_page.fadeOut();
    $login_page.off('click');
    $chatPage.show();
    $inputMessage.focus();
    $button.click(() => {
        disconnectRoom();
    });
    $(".answer-btn-2").click(() => {
        sendMessage();
    });
});

socket.on("joined", data => {
    if (!connected) {
        myId = socket.id;
        $login_page.fadeOut();
        $login_page.off('click');
        $chatPage.show();
        $inputMessage.focus();
        $button.click(() => {
            disconnectRoom();
        });
        $(".answer-btn-2").click(() => {
            sendMessage();
        })
    }
    connected = true;
    console.log(data);
    log("User: " + data.username + " has joined the room");
    data.data
        ? addUsername(data.data)
        : addUsername(data);
});

socket.on("new-message", data => {
    hasNewMessage = true;
    lastMessageId = data.msgId;
    socket.emit("delivered", data.msgId);
    addIncomeMessage(data);
});

socket.on("room-history", data => {
    hasNewMessage = true;
    fillMessageHistory(data);
});

socket.on("left", data => {
    log(data.username + " Has Left Chat");
    let element = document.getElementById(data.id);
    element.parentNode.removeChild(element);
});

socket.on("video-call-approved", room_id => {
    console.log("approved");
    console.log(room_id);
    $chatPage.hide();
    let visible = $('.video-container').is(":visible");
    if (!visible) {
        $('.video-container').show(500, 'swing', VideoCall(room_id));
    }
});

socket.on("video-call-denied", username => {
    $("#whois").text("Ignored");
    $("#mdl-body").text(username + " didn't answer");
    $videoOffer.modal();
});

socket.on("not-compatible", username => {
    $("#whois").text("Sorry :(");
    $("#mdl-body").text(username + "'s browser is not compatible");
    $videoOffer.modal();
});

socket.on("video-call", data => {
    let vtime;
    if (getUserMedia) {
        $("#whois").text(data.username + " Is Calling You");
        $videoOffer.modal({backdrop: "static"});

        $("#answer-button").click(() => {
            socket.emit("approved-video", data.id);
            $videoOffer.modal("hide");
            clearTimeout(vtime);
        });
        $("#ignore-button").click(() => {
            socket.emit("denied-video", data.id);
            $videoOffer.modal("hide");
            clearTimeout(vtime);
        });
        vtime = setTimeout(() => {
            socket.emit("denied-video", data.id);
            $videoOffer.modal("hide");
        }, 30000);
    } else {
        alert("Browser is not compatible. That means you can't use our video call system :(");
        socket.emit("denied-video", data.id, "not compatible");
    }
});

$window.ready(() => {
    let logTime,
        idle;
    $username.focus();
    $window.mousemove(() => {
        inactive = false;
        clearTimeout(logTime);
        clearTimeout(idle);
        if (connected) {
            idle = setTimeout(() => {
                inactive = true;
            }, 15000);
        }
    });
    $window.keydown(() => {
        inactive = false;
        clearTimeout(logTime);
        clearTimeout(idle);
        if (connected) {
            idle = setTimeout(() => {
                inactive = true;
            }, 15000);
        }
    });
});


function VideoCall(room) {
    let isChannelReady,
        isInitiator,
        isStarted,
        localStream,
        pc,
        remoteStream,
        mediaRecorder;

    $button2.click(() => {
        hangup();
    });

    let pcConfig = {
        'iceServers': [
            {
                'urls': 'stun:stun.l.google.com:19302'
            },
            {
                'urls': 'turn:numb.viagenie.ca',
                'credential': 'muazkh',
                'username': 'webrtc@live.com'
            },
            {
                'urls': 'turn:192.158.29.39:3478?transport=udp',
                'credential': 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                'username': '28224511:1379330808'
            },
            {
                'urls': 'turn:192.158.29.39:3478?transport=tcp',
                'credential': 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                'username': '28224511:1379330808'
            },
            {
                'urls': 'turn:turn.bistri.com:80',
                'credential': 'homeo',
                'username': 'homeo'
            },
            {
                'urls': 'turn:turn.anyfirewall.com:443?transport=tcp',
                'credential': 'webrtc',
                'username': 'webrtc'
            }
        ]
    };

    let pcConstraints = {
        'optional': [{
            'DtlsSrtpKeyAgreement': true
        }]
    };

// Set up audio and video regardless of what devices are present.
    let sdpConstraints = {
        'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': true
        }
    };

    let username = window.parent.usernameJson;

    if (room) {
        console.log("Creating or joining room");
        socket.emit("create-or-join-video", username, room);
    }

// Socket events

    socket.on("created-video-room", room => {
        console.log("Created room ", room);
        isInitiator = true;
    });

    socket.on("full", room => {
        console.log("room " + room + " is full");
    });

    socket.on("join-video-room", room => {
        console.log("Another peer made request to join room: " + room);
        console.log("This peer is initiator");
        isChannelReady = true;
    });

    socket.on("joined-video-room", room => {
        console.log("This peer has joined room " + room);
        isChannelReady = true;
    });

    socket.on('disconnect', () => {
        mediaRecorder.stop();
        disconnectRoom();
    });


///////////////////////////////////////////////

    function sendMessage(message) {
        socket.emit('message', message);
    }

    socket.on('message', message => {
        if (message !== 'object' || message.type === 'candidate') {
            console.log('Client received message:', message);
        }
        if (message === 'got user media') {
            maybeStart();
        } else if (message.type === 'offer') {
            if (!isInitiator && !isStarted) {
                maybeStart();
            }
            pc.setRemoteDescription(new RTCSessionDescription(message));
            doAnswer();
        } else if (message.type === 'answer' && isStarted) {
            pc.setRemoteDescription(new RTCSessionDescription(message));
        } else if (message.type === 'candidate' && isStarted) {
            let candidate = new RTCIceCandidate({
                sdpMLineIndex: message.label,
                candidate: message.candidate
            });
            pc.addIceCandidate(candidate);
        } else if (message === 'bye' && isStarted) {
            handleRemoteHangup();
            $('.video-container').hide();
            $chatPage.show()
        }
    });

//////////////////////////////////////////////////////

    let localvideo = $(".local"),
        remotevideo = $(".remote");

    function handleUserMedia(stream) {
        console.log('Adding local stream.');
        localvideo.attr("src", window.URL.createObjectURL(stream));
        localStream = stream;
        sendMessage('got user media');
        if (isInitiator) {
            maybeStart();
        }

        recordStream(stream);
    }

    function recordStream(stream) {
        let mediaRecorder = new MediaRecorder(stream),
            reader = new FileReader();

        mediaRecorder.ondataavailable = e => {
            reader.readAsBinaryString(e.data);
        };

        reader.addEventListener("loadend", () => {
            socket.emit("video-stream", reader.result);
        });

        mediaRecorder.start(5000);
    }

    function handleUserMediaError(error) {
        console.log('getUserMedia error: ', error);
    }

    let constraints = {
        audio: true,
        video: {
            width: { max: 640 },
            height: { max: 480 },
            frameRate: { ideal: 12 }
        }
    };
    getUserMedia.call(navigator, constraints, handleUserMedia, handleUserMediaError);

    console.log('Getting user media with constraints', constraints);

    function maybeStart() {
        if (!isStarted && localStream !== 'undefined' && isChannelReady) {
            createPeerConnection();
            pc.addStream(localStream);
            isStarted = true;
            console.log('isInitiator', isInitiator);
            if (isInitiator) {
                doCall();
            }
        }
    }

    window.onbeforeunload = e => {
        sendMessage('bye');
    };


/////////////////////////////////////////////////

    function createPeerConnection() {
        try {
            pc = new RTCPeerConnection(pcConfig, pcConstraints);
            pc.onicecandidate = handleIceCandidate;
            pc.onaddstream = handleRemoteStreamAdded;
            pc.onremovestream = handleRemoteStreamRemoved;
            console.log('Created RTCPeerConnnection');
        } catch (e) {
            console.log('Failed to create PeerConnection, exception: ' + e.message);
            alert('Cannot create RTCPeerConnection object.');
        }
    }

    function handleIceCandidate(event) {
        if (event.candidate) {
            sendMessage({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        } else {
            console.log('End of candidates.');
        }
    }

    function handleRemoteStreamAdded(event) {
        console.log('Remote stream added.');
        remoteStream = event.stream;
        remotevideo.attr("src", window.URL.createObjectURL(remoteStream));
    }

    function handleCreateOfferError(e) {
        console.log('createOffer() error: ', e);
    }

    function handleCreateAnswerError(e) {
        console.log('createAnswer () error: ', e);
    }

    function doCall() {
        console.log('Sending offer to peer');
        pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
    }

    function doAnswer() {
        console.log('Sending answer to peer.');
        pc.createAnswer(setLocalAndSendMessage, handleCreateAnswerError, sdpConstraints);
    }

    function setLocalAndSendMessage(sessionDescription) {
        sessionDescription.sdp = preferOpus(sessionDescription.sdp);
        pc.setLocalDescription(sessionDescription);
        sendMessage(sessionDescription);
    }

    function handleRemoteStreamRemoved(event) {
        console.log('Remote stream removed. Event: ', event);
    }

    function hangup() {
        stop();
        sendMessage('bye');
    }

    function handleRemoteHangup() {
        console.log('Session terminated.');
        stop();
        isInitiator = false;
    }

    function stop() {
        isStarted = false;
        pc.close();
        pc = null;
        window.location.reload();
    }

//////////////////////////////////////////////////////


    function preferOpus(sdp) {
        let sdpLines = sdp.split('\r\n'),
            mLineIndex;
        for (let i = 0; i < sdpLines.length; i++) {
            if (sdpLines[i].search('m=audio') !== -1) {
                mLineIndex = i;
                break;
            }
        }

        if (mLineIndex === null) {
            return sdp;
        }

        for (let i = 0; i < sdpLines.length; i++) {
            if (sdpLines[i].search('opus/48000') !== -1) {
                let opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
                if (opusPayload) {
                    sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
                }
                break;
            }
        }

        sdpLines = removeCN(sdpLines, mLineIndex);

        sdp = sdpLines.join('\r\n');
        return sdp;
    }

    function extractSdp(sdpLine, pattern) {
        let result = sdpLine.match(pattern);
        return result && result.length === 2 ? result[1] : null;
    }

    function setDefaultCodec(mLine, payload) {
        let elements = mLine.split(' '),
            newLine = [],
            index = 0;
        for (let i = 0; i < elements.length; i++) {
            if (index === 3) {
                newLine[index++] = payload;
            }
            if (elements[i] !== payload) {
                newLine[index++] = elements[i];
            }
        }
        return newLine.join(' ');
    }

    function removeCN(sdpLines, mLineIndex) {
        let mLineElements = sdpLines[mLineIndex].split(' ');
        for (let i = sdpLines.length - 1; i >= 0; i--) {
            let payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
            if (payload) {
                let cnPos = mLineElements.indexOf(payload);
                if (cnPos !== -1) {
                    mLineElements.splice(cnPos, 1);
                }
                sdpLines.splice(i, 1);
            }
        }

        sdpLines[mLineIndex] = mLineElements.join(' ');
        return sdpLines;
    }
}
