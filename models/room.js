const DB = require('../bin/database');

let Room = DB.Model.extend({
    tableName: 'smart-telemed.rooms',
    hasTimestamps: true,
    idAttribute: 'id'
});

module.exports = Room;