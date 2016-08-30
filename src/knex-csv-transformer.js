import fs from 'fs';
import { defaults } from 'lodash';

export const transformer = {
  seed(options) {
    return (knex, Promise) => {
      return new Promise((resolve, reject) => {
        
      });
    };
  }
};

export default transformer.seed;

class KnexCsvTransformer {
  constructor(knex, options) {
    this.knex = knex;
    this.opts = {};
    this.headers = [];
    this.records = [];
    this.results = [];
    this.parser = null;
    this.queue = null;
    this.results = [];

    this.opts = this.mergeOptions(options);
  }

  mergeOptions(options) {
    let opts = options || {};
    let defaults = {
      file: null,
      table: null,
      encoding: 'utf8',
      recordsPerQuery: 100,
      parser: {
        delimiter: ',',
        quote: '"',
        escape: '\\',
        skip_empty_lines: true,
        auto_parse: true
      }
    };

    return _.merge({}, defaults, opts);
  }
}
