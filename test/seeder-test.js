require('chai');

describe('seeder', () => {
  it('should be true', () => {
    const tr = transformer({table: 'results', file: __dirname + '/fixtures/test.csv', encoding: 'utf8'});

    console.log(typeof tr());
    expect(tr).not.to.be.undefined;
  });
});
