const config = require('config');

const knex = require('knex')({
    client: 'pg',
    connection: config.get('pg_local')
});

const DB = require('bookshelf')(knex);

module.exports = DB;