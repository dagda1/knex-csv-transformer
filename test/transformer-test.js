import chai from 'chai';
import 'babel-polyfill';

import { transformer, transfomerHeader, KnexCsvTransformer } from '../src/knex-csv-transformer';

const moment = require('moment');

const expect = chai.expect;

const transformers = [
  transfomerHeader('Div', 'division'),
  transfomerHeader('Date', 'time', function(value) {
    return new moment(value, "DD/MM/YYYY").format('YYYY-MM-DDT00:00:00');
  })
  ,
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
  }),
  transfomerHeader('null', 'location', function(value, data) {
    return data[3] === 'Liverpool' ? 'h' : 'a';
  }),
  transfomerHeader('null', 'scored', function(value, data) {
    return data[3] === 'Liverpool' ? data[5] : data[6];
  }),
  transfomerHeader('null', 'conceded', function(value, data) {
    return data[3] === 'Liverpool' ? data[6] : data[5];
  }),
  transfomerHeader('null', 'result', function(value, data, record) {
    if(record.scored > record.conceded) {
      return 'w';
    } else if(record.scored < record.conceded) {
      return 'l';
    } else if (record.scored === record.conceded){
      return 'd';
    }

    throw new Error('result record not set correctly');
  })
];

const headers = ['Div', 'Date', 'Manager', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR', 'HTHG', 'HTAG', 'HTR'];

const manager = 'Gerard Houllier';

context('knex-csv-transformer', () => {
  let manager_id = undefined;

  beforeEach(async () => {
    Promise.all([
      knex('results').del(),
      knex('teams').del()
    ]);


    const result = await knex('managers').where({name: manager}).select('id');

    manager_id = result[0].id;
  });

  context('when merging transformer headers',() => {
    describe('transfomerHeader', () => {
      const transformer = new KnexCsvTransformer(knex);

      beforeEach(async () => {
        transformer.headers = headers;
        transformer.opts = transformer.mergeOptions({transformers});
      });

      it('creates the transformers', () => {
        const transformed = transformer.opts.transformers;

        expect(transformed.length).to.equal(9);
      });

      it('creates the transformed object', async () => {
        const csvRecord = ['PREMIER', '07/11/1998', manager, 'Liverpool', 'Wimbledon', 0, 1, 'A', 0, 1, 'A'];

        const record = await transformer.createObjectFrom(csvRecord);

        expect(record.division).to.equal('PREMIER');

        expect(record.time).to.equal('1998-11-07T00:00:00');

        expect(record.manager_id).to.equal(manager_id);

        expect(record.team_id).not.to.be.undefined;

        const team = await knex("teams").where({id: record.team_id}).return('name');

        expect(team).to.equal(team);

        expect(record.location).to.equal('h');

        expect(record.scored).to.equal(0);

        expect(record.conceded).to.equal(1);

        expect(record.result).to.equal('l');
      });
    });
  });

  context('when importing a csv file', () => {
    beforeEach(() => {
      Promise.all([
        knex('results').del(),
      ]);
    });

    describe('transformer', () => {
      it('transforms the data, imports the csv file and creates the records', async () => {
        const ignoreIf = (data) => data[3] !== 'Liverpool' && data[4] !== 'Liverpool';
        const opts = { table: 'results', file: __dirname + '/fixtures/test.csv', encoding: 'utf8', transformers, ignoreIf: ignoreIf };

        await transformer.seed(opts)(knex, Promise);

        const results = await knex('results');

        expect(results.length).to.equal(2);

        const firstResult = results[0];

        const team_id = await knex('teams').where({name: 'Wimbledon'}).select('id');

        expect(team_id[0].id).to.equal(results[0].team_id);

        expect(manager_id).to.equal(results[0].manager_id);
      });
    });
  });
});
