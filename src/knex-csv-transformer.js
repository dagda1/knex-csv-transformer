import fs from 'fs';
import { merge, findIndex, isObject, isFunction, isArray } from 'lodash';
import { EventEmitter } from 'events';
import parse from 'csv-parse';
import iconv from 'iconv-lite';
import { Promise } from 'bluebird';

export const transformer = {
  seed(options) {
    return (knex, Promise) => {
      return new Promise((resolve, reject) => {
        KnexCsvTransformer.fromKnexClient(knex)
          .on('end', resolve)
          .on('error', reject)
          .generate(options);
      });
    };
  }
};

const identity = (x) => x;

export function transfomerHeader(column, field, formatter, options) {
  if(!isFunction(formatter)) {
    options = formatter;
    formatter = undefined;
  }

  if(!formatter) {
    formatter = identity;
  }

  options = options || {};

  if(!options.hasOwnProperty('addIf')) {
    options.addIf = () => true;
  }

  return {
    column,
    field,
    formatter,
    options
  };
}

export default transformer.seed;

export class KnexCsvTransformer extends EventEmitter {
  constructor(knex) {
    super();
    this.opts = {};
    this.knex = knex;
    this.headers = [];
    this.transformers = [];
    this.records = [];
    this.parser = null;
    this.queue = null;
    this.results = [];
    this.transformers = [];
    this.onReadable = this.onReadable.bind(this);
    this.onEnd = this.onEnd.bind(this);
    this.onSucceeded = this.onSucceeded.bind(this);
    this.onFailed = this.onFailed.bind(this);
  }

  static fromKnexClient(knex) {
    return new KnexCsvTransformer(knex);
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

    return merge({}, defaults, opts);
  }

  generate(options) {
    this.opts = this.mergeOptions(options);

    this.parser = parse(this.opts.parser);
    this.parser.on('readable', this.onReadable);
    this.parser.on('end', this.onEnd);
    this.parser.on('error', this.onFailed);

    this.queue = Promise.bind(this).then( this.createCleanUpQueue() );

    this.csv = fs.createReadStream(this.opts.file);
    this.csv.pipe( iconv.decodeStream(this.opts.encoding) ).pipe(this.parser);
  }

  async onReadable() {
    let obj = {};
    let record = this.parser.read();

    if (record === null) {
      return;
    }

    if (this.parser.count <= 1) {
      this.headers = record;
    } else {
      this.records.push( await this.createObjectFrom(record) );
    }

    if (this.records.length < this.opts.recordsPerQuery) {
      return;
    }

    this.queue = this.queue.then( this.createBulkInsertQueue() );
  }

  onEnd() {
    if (this.records.length > 0) {
      this.queue = this.queue.then( this.createBulkInsertQueue() );
    }
    this.queue.then(() => {
      return this.emit('end', this.results);
    }).catch(this.onFailed);
  }

  createCleanUpQueue() {
    return () => {
      return this.knex(this.opts.table).del()
        .then(this.onSucceeded)
        .catch(this.onFailed);
    };
  }

  createBulkInsertQueue() {
    const records = this.records.splice(0, this.opts.recordsPerQuery);

    return () => {
      return this.knex(this.opts.table)
        .insert(records)
        .then(this.onSucceeded)
        .catch(this.onFailed);
    };
  }

  async createObjectFrom(record) {
    let obj = {};

    for(let i = 0, l = this.opts.transformers.length; i < l; i++) {
      let transformer = this.opts.transformers[i];

      const headerIndex = findIndex(this.headers, (header) => {
        return header === transformer.column;
      });

      let csvValue = record[headerIndex];

      if(transformer.options.lookUp) {
        const lookUp = transformer.options.lookUp;

        const whereClause = {};

        whereClause[lookUp.column] = csvValue;

        const result = await this.knex(lookUp.table).where(whereClause).select(lookUp.scalar);

        if(result.length) {
          csvValue = result[0][lookUp.scalar];
        } else {
          if(lookUp.createIfNotExists && lookUp.createIfNotEqual(csvValue)) {
            const insert = {[lookUp.column]: csvValue};

            const inserted = await this.knex(lookUp.table)
              .insert(insert)
              .returning('id');

            csvValue = inserted[0];
          }
        }
      }

      const value = transformer.formatter(csvValue, record, obj);

      if((value != undefined && value != null) && transformer.options.addIf(value)) {
        obj[transformer.field] = value;
      }
    }

    return Promise.resolve(obj);
  }

  async executeQuery() {
    return await this.knex('managers').select('name');
  }

  onSucceeded(res) {
    this.results.push(res);
  }

  onFailed(err) {
    console.dir(err);
    this.csv.unpipe();
    this.emit('error', err);
  }
}
