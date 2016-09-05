import chai from 'chai';
import 'babel-polyfill';

import { KnexCsvTransformer, transfomerHeader } from '../src/knex-csv-transformer';

const moment = require('moment');

const expect = chai.expect;

const transformers = [
  transfomerHeader('Date', 'time', function(value) {
    return new moment(value, "DD/MM/YYYY").format('YYYY-MM-DDT00:00:00');
  }),
  transfomerHeader('Manager', 'manager_id', {
    lookUp: {
      table: 'managers',
      column: 'name',
      scalar: 'id'
    }
  }),
  transfomerHeader('HomeTeam', 'team_id', {
    lookUp: {
      table: 'teams',
      column: 'name',
      scalar: 'id',
      createIfNotExists: true,
      createIfNotEqual: (value) => value !== "Liverpool"
    },
    addIf: (value) => value !== "Liverpool"
  }),
  transfomerHeader('AwayTeam', 'team_id', {
    lookUp: {
      table: 'teams',
      column: 'name',
      scalar: 'id',
      createIfNotExists: true,
      createIfNotEqual: (value) => value !== "Liverpool"
    },
    addIf: (value) => value !== "Liverpool"
  })
];

const headers = ['Div', 'Date', 'Manager', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR', 'HTHG', 'HTAG', 'HTR'];

const manager = 'Gerard Houllier';

context('knex-csv-transformer', () => {
  beforeEach(() => {
    Promise.all([
      knex('results').del(),
      knex('teams').del()
    ]);
  });

  context('when merging transformer headers',() => {
    describe('transformer', () => {
      const transformer = new KnexCsvTransformer(knex);
      let manager_id = undefined;

      beforeEach(async () => {
        transformer.headers = headers;
        transformer.opts = transformer.mergeOptions({transformers});

        const result = await knex('managers').where({name: manager}).select('id');

        manager_id = result[0].id;
      });

      it('creates the transformers', () => {
        const transformed = transformer.opts.transformers;

        expect(transformed.length).to.equal(4);
      });

      it('creates the transformed object', async () => {
        const csvRecord = ['E0', '07/11/1998', manager, 'Liverpool', 'Wimbledon', 0, 1, 'A', 0, 1, 'A'];

        const record = await transformer.createObjectFrom(csvRecord);

        expect(record.time).to.equal('1998-11-07T00:00:00');

        expect(record.manager_id).to.equal(manager_id);

        expect(record.team_id).not.to.be.undefined;

        const team = await knex("teams").where({id: record.team_id}).return('name');

        expect(team).to.equal(team);
      });
    });
  });
});

// context('when importing with headers', () => {
//   beforeEach(() => {
//     Promise.all([
//       knex('results').del(),
//     ]);
//   });

//   describe('transformer', () => {
//     it('merge the headers', async () => {
//       const opts = {table: 'results', file: __dirname + '/fixtures/test.csv', encoding: 'utf8', transformers};
//       new KnexCsvTransformer(knex).generate(opts);
//     });
//   });
// });
