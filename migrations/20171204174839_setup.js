exports.up = function(knex, Promise) {
    return knex.schema.createTable('smart-telemed.rooms', tbl => {
        tbl.increments('id').unsigned().index().primary();
        tbl.string('name');
        tbl.timestamp('created_at');
        tbl.timestamp('updated_at');
    })
    .then(() => {
        return knex.schema.createTable('smart-telemed.chats', tbl => {
            tbl.increments('id').unsigned().index().primary();
            tbl.integer('room').unsigned().index().references('id').inTable('smart-telemed.rooms');
            tbl.string('user');
            tbl.text('msg');
            tbl.timestamp('created_at');
            tbl.timestamp('updated_at');
        })
    })
};

exports.down = function(knex, Promise) {
    return Promise.all([
        knex.schema.dropTable('smart-telemed.rooms')
            .then(() => {
                return knex.schema.dropTable('smart-telemed.chats');
            })
    ])
};
