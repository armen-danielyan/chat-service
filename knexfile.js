const config = require('config');

module.exports = {

    development: {
        client: 'pg',
        connection: config.get('pg_local')
    },

    staging: {},

    production: {}

};
