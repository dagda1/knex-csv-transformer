import fs from 'fs';
import { merge, findIndex, isObject, isFunction, isArray } from 'lodash';
import { EventEmitter } from 'events';
import parse from 'csv-parse';
import iconv from 'iconv-lite';
import { Promise } from 'bluebird';

export const seeder = {
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

export default seeder.seed;

const identity = (x) => x;

export function transfomerHeader(column, field, formatter, options) {
  if(!formatter && !options) {
    formatter = identity;
  }

  if(!isFunction(formatter)) {
    options = formatter;
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

class KnexCsvTransformer extends EventEmitter {

  constructor(knex) {
    super();
    this.opts = {};
    this.knex = knex;
    this.headers = [];
    this.records = [];
    this.parser = null;
    this.queue = null;
    this.results = [];
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

  onReadable() {
    let obj = {};
    let record = this.parser.read();

    if (record === null) {
      return;
    }

    if (this.parser.count <= 1) {
      this.headers = record;
    } else if(!this.opts.ignoreIf(record)){
      const newRecord = this.createObjectFrom(record);
      this.records.push( newRecord );
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
    //const records = this.records.splice(0, this.opts.recordsPerQuery);

    return () => {
      return new Promise((resolver, rejecter) => {
        Promise.all(this.records).then((res) => {
          console.log('here');
          console.dir(res);
        }).catch((err) => {
          console.dir(err);
        });
      });
      // return this.knex(this.opts.table)
      //   .insert(this.records)
      //   .then(this.onSucceeded)
      //   .catch(this.onFailed);
    };
  }

  createObjectFrom(record) {
    const self = this;
    const promises = [];

    return new Promise((resolve, reject) => {
      const getValue = (transformer, csvValue, obj) => {
        const value = transformer.formatter(csvValue, record, obj);

        if((value != undefined && value != null) && transformer.options.addIf(value)) {
          return value;
        }
      };

      for(let i = 0, l = self.opts.transformers.length; i < l; i++) {
        let transformer = self.opts.transformers[i];

        const headerIndex = findIndex(self.headers, (header) => {
          return header === transformer.column;
        });

        let csvValue = record[headerIndex];

        if(transformer.options.lookUp) {
          promises.push(new Promise((resolve, reject) => {
            const lookUp = transformer.options.lookUp;

            const whereClause = {};

            whereClause[lookUp.column] = csvValue;

            self.knex(lookUp.table).where(whereClause).select(lookUp.scalar).then((result) => {
              if(result.length) {
                return resolve({
                  transformer,
                  value: result[0][lookUp.scalar],
                  headerIndex,
                  record
                });
              }else {
                if(lookUp.createIfNotExists && lookUp.createIfNotEqual(csvValue)) {
                  const insert = {[lookUp.column]: csvValue};

                  self.knex(lookUp.table)
                    .insert(insert)
                    .returning('id')
                    .then((inserted) => {
                      return resolve({
                        transformer,
                        value: inserted[0],
                        headerIndex,
                        record
                      });
                    });
                } else {
                  resolve({
                    transformer,
                    value: undefined,
                    headerIndex,
                    record
                  });
                }
              }
            });
          }));
        } else {
          promises.push(Promise.resolve({
            transformer,
            value: csvValue,
            headerIndex,
            record
          }));
        }
      }

      return Promise.all(promises).then((result) => {
        const obj = result.reduce((prev, curr, index, arr) => {
          const value = getValue(curr.transformer, curr.value, prev);

          if(value === undefined && value === null) {
            return prev;
          }

          prev[curr.transformer.field] = value;

          return prev;
        }, {});

        console.dir(obj);

        resolve(obj);
      }).catch((err) => {
        console.log('in Promise.all error');
        console.dir(err);
      });
    });
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
