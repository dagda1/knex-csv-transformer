import chai from 'chai';
import 'babel-polyfill';

import { KnexCsvTransformer, transfomerHeader } from '../src/knex-csv-transformer';

const moment = require('moment');

const expect = chai.expect

const transformers = [
  transfomerHeader('Date', 'time', function(value) {
    return new moment(value, "DD/MM/YYYY").format('YYYY-MM-DDT00:00:00');
  }),
  transfomerHeader('Manager', 'manager_id', {
    lookUp: 'SELECT id FROM managers WHERE name = ?;'
  }),
  transfomerHeader('HomeTeam', 'location', function(row) {
    console.log('in home team with row', row);
  })
];

const headers = ['Div', 'Date', 'Manager', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR', 'HTHG', 'HTAG', 'HTR'];

context('when merging transformer headers',() => {
  describe('transformer', () => {
    const transformer = new KnexCsvTransformer();

    beforeEach(() => {
      transformer.headers = headers;
      transformer.opts = transformer.mergeOptions({transformers});
    });

    it('creates the transformers', () => {
      const transformed = transformer.opts.transformers;

      expect(transformed.length).to.equal(3);
    });

    it('creates the transformed object', () => {
      const csvRecord = ['E0', '07/11/1998', 'Gerard Houllier', 'Liverpool', 'Wimbledon', 0, 1, 'A', 0, 1, 'A'];

      const record = transformer.createObjectFrom(csvRecord);

      expect(record.time).to.equal('1998-11-07T00:00:00');
    });
  });
});

context('when importing with headers', () => {
  beforeEach(() => {
    Promise.all([
      knex('results').del(),
      knex('teams').del(),
      knex('managers').del()
    ]);
  });

  describe('transformer', () => {
    it('merge the headers', () => {
      const seeder = transformer({table: 'results', file: __dirname + '/fixtures/test.csv', encoding: 'utf8', transformers});

      seeder(knex, Promise).then((res) => {
        console.log(res);
      }).catch((err) => {
        console.log(err);
        throw err;
      });
    });
  });
});
