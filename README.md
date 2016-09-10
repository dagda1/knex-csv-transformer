# KNEX-CSV-TRANSFORMER

You will need the following things properly installed on your computer.

* [Node.js](http://nodejs.org/) (with NPM)

## Basic usage

Create a seed file for Knex.

    knex seed:make seed_name

Use the ```transfomerHeader``` function to create an array of transformations that specify an input column from the csv file and a destination column in the database table.

Change the code to import the data from CSV.
```js
const knex = require('knex');
const moment = require('moment');

const path = require('path');

const transformer = require('knex-csv-transformer').transformer;
const transfomerHeader = require('knex-csv-transformer').transfomerHeader;

exports.seed = transformer.seed({
  table: 'results',
  file: path.join(__dirname, '../api/csv/1998-1999.csv'),
  transformers: [
    transfomerHeader('Div', 'division'),
    transfomerHeader('Date', 'time', function(value) {
      return new moment(value, "DD/MM/YYYY").format('YYYY-MM-DDT00:00:00');
  })]
});
```
## transformerHeader function
In order to transform rows in an input csv file to fields in a destination table, you need to create an array of transformations with each transformation created from the ```transformerHeader``` function.

A basic transformation is outlined below where a column in the csv file is specified as the first argument and a destination field in the specified table is specified in the second argument:
```js
exports.seed = transformer.seed({
  table: 'results',
  transformers: [
    transfomerHeader('Div', 'division')
  })]
```
### formatter function
It is possible to pass a formatter function that can perform a transformation on the data before its insertion in the destination table:
```js
exports.seed = transformer.seed({
  table: 'results',
  transformers: [
    transfomerHeader('Date', 'time', function(value) {
      return new moment(value, "DD/MM/YYYY").format('YYYY-MM-DDT00:00:00');
  })]
});
```
The code above fromats the ```Date``` field in the csv file into the correct fromat that the destination ```time``` field in the database expects.

### Look up values in the same database
```js
exports.seed = transformer.seed({
  table: 'results',
  transformers: [
    transfomerHeader('Manager', 'manager_id', {
      lookUp: {
        table: 'managers',
        column: 'name',
        scalar: 'id',
        createIfNotExists: true,
      }
  })]
});
```
The transformer above will perform a look up query on the managers table and select the id of whatever name is in the ```Manager``` field of the csv file and use this value to insert into the ```manager_id``` field in the database.  The ```createIfNotExists``` option above specifies whether or not to create the record in the managers table if it does not already exist.

A good example of what transformations are available can be found in [the tests](https://github.com/dagda1/knex-csv-transformer/blob/master/test/transformer-test.js#L10) of this package.

## Installation

* `npm install`

### Global installation of mocha

If you have mocha installed globally you need to install mocha-given globally as well.
```
$ npm install -g mocha mocha-given
```

### Running Tests
* Make sure you have phantomjs installed, `npm install -g phantomjs`
* `npm  test`
