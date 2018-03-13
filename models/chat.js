const DB = require('../bin/database');

let Chat = DB.Model.extend({
    tableName: 'smart-telemed.chats',
    hasTimestamps: true,
    idAttribute: 'id'
});

module.exports = Chat;