require('chai');

import { KnexCsvTransformer, transfomerHeader } from '../src/knex-csv-transformer';

const headers = [
  transfomerHeader('Date', 'time', function(row) {
    console.log('in Date with', row);
  }),
  transfomerHeader('Manager', 'manager_id', {
    lookUp: 'SELECT id FROM managers WHERE name = ?;'
  }),
  transfomerHeader('Home Team', 'location', function(row) {
    console.log('in home team with row', row);
  })
];

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
      const seeder = transformer({table: 'results', file: __dirname + '/fixtures/test.csv', encoding: 'utf8'});

      expect(seeder).not.to.be.undefined;
    });
  });
});
