global.transformer = require('../src/knex-csv-transformer').default;
global.Promise = require('bluebird');

global.knex = require('knex')({
  client: 'postgresql',
  connection: {
    host: '127.0.0.1',
    port: 5432,
    user: 'knex',
    database: 'knex',
    password: 'knex',
    charset: 'utf8'
  },
  migrations: {
    tableName: 'knex_migrations'
  }
});
