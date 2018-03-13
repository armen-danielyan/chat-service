# Chat protocol


## Content

  * [General information](#General-information)
  * [Technical information](#Technical-information)
  * [Available methods](#Available-methods)
    * [Set user](#Set-user)
    * [Create room](#Create-room)
    * [Receive users statuses](#Receive-users-statuses)
    * [User is typing Status](#User-is-typing-Status)
    * [Messaging](#Messaging)
    * [Delivered status](#Delivered-status)
    * [Seen status](#Seen-status)

## General information

  * Based on socket.io, Redis, PostgreSQL
  * Exchange is only possible between the client and the server

## Technical information

For web browsers, it is recommended to use the library [socket.io](https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.0.4/socket.io.js). 
You should use the following url as a connection parameter:

    http://[your domain]/chat

## Available methods

### Set user

Set user on server:

    /**
     * Event Name: set-user-data
     * Params: [User Id]
     */
    socket.emit('set-user-data', '5fce199c-0c77-4c74-ad86-56cebf5c33d9')

### Create room

User should create a room to chat with other user. When creating a room, the user
should provide the other user's id who will become a member of the room:

    /**
     * Event Name: set-room
     * Params: [Other User's Id]
     */
    socket.emit('set-room', 'a0380e4f-9bc9-4e4c-b6ae-5f0daac22104')
    
User will receive the chat history, if session is not expired.
Session will expire, if user stayed offline for 180 seconds.
    
    /**
     * Event Name: room-history
     * callback([{
         id: 150, 
         room: 20, 
         msg_from: '5fce199c-0c77-4c74-ad86-56cebf5c33d9', 
         msg_to: 'a0380e4f-9bc9-4e4c-b6ae-5f0daac22104',
         msg: 'Hello World',
         created_at: '2017-12-07 11:37:44',
         updated_at: '2017-12-07 11:37:44'}, ...])
     */
    socket.on('set-room', msgList => {
        ...
    })
    
### Receive users statuses

User gets users statuses:

    /**
     * Event Name: online-stack
     * callback([{'5fce199c-0c77-4c74-ad86-56cebf5c33d9': 'Online'}, {'a0380e4f-9bc9-4e4c-b6ae-5f0daac22104': 'Offline'}, ...])
     */
    socket.on('online-stack', userList => {
        ...
    })
    
### User is typing Status

The user gets the 'is typeing ...' message, when the other user in the room is typing:

    /**
     * Event Name: set-typing
     * callback('is typeing ...')
     */
    socket.on('set-typing', message => {
        ...
    })
    
If user typing a message, then should send the status typing to the room 

    /**
     * Event Name: typing
     */
    socket.emit('typing');
    
### Messaging

User sends a message to the room:

    /**
     * Event Name: chat-msg
     * Params: {msg, msgTo, date}
     */
    socket.emit('chat-msg', {msg: 'Hello', msgTo: '5fce199c-0c77-4c74-ad86-56cebf5c33d9', date: '27-07-2017 15:30 pm'})
    
User receives a message:

    /**
     * Event Name: chat-msg
     * callback({msgFrom, msg, msgId, date})
     */
    socket.on('chat-msg', {msgFrom: '5fce199c-0c77-4c74-ad86-56cebf5c33d9', msg: 'Hello', msgId: 1563, date: '27-07-2017 15:30 pm'})
    
### Delivered status

User sends the message Id, when received the message:

    /**
     * Event Name: delivered
     * Params: messageId
     */
    socket.emit('delivered', 1548)
    
User receives the message Id, when other user got the message:

    /**
     * Event Name: set-delivered
     * callback(messageId)
     */
    socket.on('set-delivered', messageId => {
        ...
    });
    
### Seen status

User sends the message Id, when read the message:

    /**
     * Event Name: seen
     * Params: messageId
     */
    socket.emit('seen', 1548)
    
User receives the message Id, when other user read the message:

    /**
     * Event Name: set-seen
     * callback(messageId)
     */
    socket.on('set-seen', messageId => {
        ...
    });