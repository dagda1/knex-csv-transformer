'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.KnexCsvTransformer = exports.transformer = undefined;
exports.transfomerHeader = transfomerHeader;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _lodash = require('lodash');

var _events = require('events');

var _csvParse = require('csv-parse');

var _csvParse2 = _interopRequireDefault(_csvParse);

var _iconvLite = require('iconv-lite');

var _iconvLite2 = _interopRequireDefault(_iconvLite);

var _bluebird = require('bluebird');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new _bluebird.Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return _bluebird.Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

const transformer = exports.transformer = {
  seed(options) {
    return (knex, Promise) => {
      return new Promise((resolve, reject) => {
        KnexCsvTransformer.fromKnexClient(knex).on('end', results => {
          resolve(results);
        }).on('error', reject).generate(options);
      });
    };
  }
};

const identity = x => x;

function transfomerHeader(column, field, formatter, options) {
  if (!formatter && !options) {
    formatter = identity;
  }

  if (!(0, _lodash.isFunction)(formatter)) {
    options = formatter;
    formatter = identity;
  }

  options = options || {};

  if (!options.hasOwnProperty('addIf')) {
    options.addIf = () => true;
  }

  return {
    column,
    field,
    formatter,
    options
  };
}

class KnexCsvTransformer extends _events.EventEmitter {
  constructor(knex) {
    super();
    this.opts = {};
    this.knex = knex;
    this.headers = [];
    this.transformers = [];
    this.records = [];
    this.parser = null;
    this.queue = null;
    this.promises = [];
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
      ignoreIf: () => false,
      parser: {
        delimiter: ',',
        quote: '"',
        escape: '\\',
        skip_empty_lines: true,
        auto_parse: true
      }
    };

    return (0, _lodash.merge)({}, defaults, opts);
  }

  generate(options) {
    this.opts = this.mergeOptions(options);

    this.parser = (0, _csvParse2.default)(this.opts.parser);
    this.parser.on('readable', this.onReadable);
    this.parser.on('end', this.onEnd);
    this.parser.on('error', this.onFailed);

    this.queue = _bluebird.Promise.bind(this).then(this.createCleanUpQueue());

    this.csv = _fs2.default.createReadStream(this.opts.file);
    this.csv.pipe(_iconvLite2.default.decodeStream(this.opts.encoding)).pipe(this.parser);
  }

  onReadable() {
    let record = this.parser.read();

    if (record === null) {
      return;
    }

    if (this.parser.count <= 1) {
      this.headers = record;
    } else {
      if (!this.opts.ignoreIf(record)) {
        const promise = this.createObjectFrom(record);
        this.promises.push(promise);
      }
    }
  }

  onEnd() {
    _bluebird.Promise.all(this.promises).then(values => {
      if (values.length > 0) {
        this.queue = this.queue.then(this.createBulkInsertQueue(values));
      }
      this.queue.then(() => {
        return this.emit('end', this.results);
      }).catch(this.onFailed);
    });
  }

  createCleanUpQueue() {
    return () => {
      return this.knex(this.opts.table).del().then(this.onSucceeded).catch(this.onFailed);
    };
  }

  createBulkInsertQueue(values) {
    return () => {
      return this.knex(this.opts.table).insert(values).then(this.onSucceeded).catch(this.onFailed);
    };
  }

  createObjectFrom(record) {
    const self = this;

    return new _bluebird.Promise((() => {
      var _ref = _asyncToGenerator(function* (resolve, reject) {
        let obj = {};

        for (let i = 0, l = self.opts.transformers.length; i < l; i++) {
          let transformer = self.opts.transformers[i];

          const headerIndex = (0, _lodash.findIndex)(self.headers, function (header) {
            return header === transformer.column;
          });

          let csvValue = record[headerIndex];

          if (transformer.options.lookUp) {
            const lookUp = transformer.options.lookUp;

            const whereClause = {};

            whereClause[lookUp.column] = csvValue;

            const result = yield self.knex(lookUp.table).where(whereClause).select(lookUp.scalar);

            if (result.length) {
              csvValue = result[0][lookUp.scalar];
            } else {
              if (lookUp.createIfNotExists && lookUp.createIfNotEqual(csvValue)) {
                const insert = { [lookUp.column]: csvValue };

                const inserted = yield self.knex(lookUp.table).insert(insert).returning('id');

                csvValue = inserted[0];
              }
            }
          }

          const value = transformer.formatter(csvValue, record, obj);

          if (value != undefined && value != null && transformer.options.addIf(value)) {
            obj[transformer.field] = value;
          }
        }

        return resolve(obj);
      });

      return function (_x, _x2) {
        return _ref.apply(this, arguments);
      };
    })());
  }

  onSucceeded(res) {
    this.promises.push(res);
  }

  onFailed(err) {
    console.dir(err);
    this.csv.unpipe();
    this.emit('error', err);
  }
}
exports.KnexCsvTransformer = KnexCsvTransformer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9rbmV4LWNzdi10cmFuc2Zvcm1lci5qcyJdLCJuYW1lcyI6WyJ0cmFuc2ZvbWVySGVhZGVyIiwidHJhbnNmb3JtZXIiLCJzZWVkIiwib3B0aW9ucyIsImtuZXgiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsIktuZXhDc3ZUcmFuc2Zvcm1lciIsImZyb21LbmV4Q2xpZW50Iiwib24iLCJyZXN1bHRzIiwiZ2VuZXJhdGUiLCJpZGVudGl0eSIsIngiLCJjb2x1bW4iLCJmaWVsZCIsImZvcm1hdHRlciIsImhhc093blByb3BlcnR5IiwiYWRkSWYiLCJjb25zdHJ1Y3RvciIsIm9wdHMiLCJoZWFkZXJzIiwidHJhbnNmb3JtZXJzIiwicmVjb3JkcyIsInBhcnNlciIsInF1ZXVlIiwicHJvbWlzZXMiLCJvblJlYWRhYmxlIiwiYmluZCIsIm9uRW5kIiwib25TdWNjZWVkZWQiLCJvbkZhaWxlZCIsIm1lcmdlT3B0aW9ucyIsImRlZmF1bHRzIiwiZmlsZSIsInRhYmxlIiwiZW5jb2RpbmciLCJyZWNvcmRzUGVyUXVlcnkiLCJpZ25vcmVJZiIsImRlbGltaXRlciIsInF1b3RlIiwiZXNjYXBlIiwic2tpcF9lbXB0eV9saW5lcyIsImF1dG9fcGFyc2UiLCJ0aGVuIiwiY3JlYXRlQ2xlYW5VcFF1ZXVlIiwiY3N2IiwiY3JlYXRlUmVhZFN0cmVhbSIsInBpcGUiLCJkZWNvZGVTdHJlYW0iLCJyZWNvcmQiLCJyZWFkIiwiY291bnQiLCJwcm9taXNlIiwiY3JlYXRlT2JqZWN0RnJvbSIsInB1c2giLCJhbGwiLCJ2YWx1ZXMiLCJsZW5ndGgiLCJjcmVhdGVCdWxrSW5zZXJ0UXVldWUiLCJlbWl0IiwiY2F0Y2giLCJkZWwiLCJpbnNlcnQiLCJzZWxmIiwib2JqIiwiaSIsImwiLCJoZWFkZXJJbmRleCIsImhlYWRlciIsImNzdlZhbHVlIiwibG9va1VwIiwid2hlcmVDbGF1c2UiLCJyZXN1bHQiLCJ3aGVyZSIsInNlbGVjdCIsInNjYWxhciIsImNyZWF0ZUlmTm90RXhpc3RzIiwiY3JlYXRlSWZOb3RFcXVhbCIsImluc2VydGVkIiwicmV0dXJuaW5nIiwidmFsdWUiLCJ1bmRlZmluZWQiLCJyZXMiLCJlcnIiLCJjb25zb2xlIiwiZGlyIiwidW5waXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7UUF3QmdCQSxnQixHQUFBQSxnQjs7QUF4QmhCOzs7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7QUFFTyxNQUFNQyxvQ0FBYztBQUN6QkMsT0FBS0MsT0FBTCxFQUFjO0FBQ1osV0FBTyxDQUFDQyxJQUFELEVBQU9DLE9BQVAsS0FBbUI7QUFDeEIsYUFBTyxJQUFJQSxPQUFKLENBQVksQ0FBQ0MsT0FBRCxFQUFVQyxNQUFWLEtBQXFCO0FBQ3RDQywyQkFBbUJDLGNBQW5CLENBQWtDTCxJQUFsQyxFQUNHTSxFQURILENBQ00sS0FETixFQUNjQyxPQUFELElBQWE7QUFDdEJMLGtCQUFRSyxPQUFSO0FBQ0QsU0FISCxFQUlHRCxFQUpILENBSU0sT0FKTixFQUllSCxNQUpmLEVBS0dLLFFBTEgsQ0FLWVQsT0FMWjtBQU1ELE9BUE0sQ0FBUDtBQVFELEtBVEQ7QUFVRDtBQVp3QixDQUFwQjs7QUFlUCxNQUFNVSxXQUFZQyxDQUFELElBQU9BLENBQXhCOztBQUVPLFNBQVNkLGdCQUFULENBQTBCZSxNQUExQixFQUFrQ0MsS0FBbEMsRUFBeUNDLFNBQXpDLEVBQW9EZCxPQUFwRCxFQUE2RDtBQUNsRSxNQUFHLENBQUNjLFNBQUQsSUFBYyxDQUFDZCxPQUFsQixFQUEyQjtBQUN6QmMsZ0JBQVlKLFFBQVo7QUFDRDs7QUFFRCxNQUFHLENBQUMsd0JBQVdJLFNBQVgsQ0FBSixFQUEyQjtBQUN6QmQsY0FBVWMsU0FBVjtBQUNBQSxnQkFBWUosUUFBWjtBQUNEOztBQUVEVixZQUFVQSxXQUFXLEVBQXJCOztBQUVBLE1BQUcsQ0FBQ0EsUUFBUWUsY0FBUixDQUF1QixPQUF2QixDQUFKLEVBQXFDO0FBQ25DZixZQUFRZ0IsS0FBUixHQUFnQixNQUFNLElBQXRCO0FB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QyxDQUFDUSxPQUFPekQsTUFBUixHQUFpQndELFFBQWxCLEVBQWY7O0FBRUEsc0JBQU1TLFdBQVcsTUFBTWYsS0FBSzdELElBQUwsQ0FBVW9FLE9BQU9wQyxLQUFqQixFQUNkNEIsTUFEYyxDQUNQQSxNQURPLEVBRWRpQixTQUZjLENBRUosSUFGSSxDQUF2Qjs7QUFJQVYsMkJBQVdTLFNBQVMsQ0FBVCxDQUFYO0FBQ0Q7QUFDRjtBQUNGOztBQUVELGdCQUFNRSxRQUFRakYsWUFBWWdCLFNBQVosQ0FBc0JzRCxRQUF0QixFQUFnQ3BCLE1BQWhDLEVBQXdDZSxHQUF4QyxDQUFkOztBQUVBLGNBQUlnQixTQUFTQyxTQUFULElBQXNCRCxTQUFTLElBQWhDLElBQXlDakYsWUFBWUUsT0FBWixDQUFvQmdCLEtBQXBCLENBQTBCK0QsS0FBMUIsQ0FBNUMsRUFBOEU7QUFDNUVoQixnQkFBSWpFLFlBQVllLEtBQWhCLElBQXlCa0UsS0FBekI7QUFDRDtBQUNGOztBQUVELGVBQU81RSxRQUFRNEQsR0FBUixDQUFQO0FBQ0QsT0E1Q007O0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FBUDtBQTZDRDs7QUFFRG5DLGNBQVlxRCxHQUFaLEVBQWlCO0FBQ2YsU0FBS3pELFFBQUwsQ0FBYzZCLElBQWQsQ0FBbUI0QixHQUFuQjtBQUNEOztBQUVEcEQsV0FBU3FELEdBQVQsRUFBYztBQUNaQyxZQUFRQyxHQUFSLENBQVlGLEdBQVo7QUFDQSxTQUFLdEMsR0FBTCxDQUFTeUMsTUFBVDtBQUNBLFNBQUszQixJQUFMLENBQVUsT0FBVixFQUFtQndCLEdBQW5CO0FBQ0Q7QUEvSmtEO1FBQXhDN0Usa0IsR0FBQUEsa0IiLCJmaWxlIjoia25leC1jc3YtdHJhbnNmb3JtZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgbWVyZ2UsIGZpbmRJbmRleCwgaXNPYmplY3QsIGlzRnVuY3Rpb24sIGlzQXJyYXkgfSBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCBwYXJzZSBmcm9tICdjc3YtcGFyc2UnO1xuaW1wb3J0IGljb252IGZyb20gJ2ljb252LWxpdGUnO1xuaW1wb3J0IHsgUHJvbWlzZSB9IGZyb20gJ2JsdWViaXJkJztcblxuZXhwb3J0IGNvbnN0IHRyYW5zZm9ybWVyID0ge1xuICBzZWVkKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gKGtuZXgsIFByb21pc2UpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIEtuZXhDc3ZUcmFuc2Zvcm1lci5mcm9tS25leENsaWVudChrbmV4KVxuICAgICAgICAgIC5vbignZW5kJywgKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUocmVzdWx0cyk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAub24oJ2Vycm9yJywgcmVqZWN0KVxuICAgICAgICAgIC5nZW5lcmF0ZShvcHRpb25zKTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH1cbn07XG5cbmNvbnN0IGlkZW50aXR5ID0gKHgpID0+IHg7XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2ZvbWVySGVhZGVyKGNvbHVtbiwgZmllbGQsIGZvcm1hdHRlciwgb3B0aW9ucykge1xuICBpZighZm9ybWF0dGVyICYmICFvcHRpb25zKSB7XG4gICAgZm9ybWF0dGVyID0gaWRlbnRpdHk7XG4gIH1cblxuICBpZighaXNGdW5jdGlvbihmb3JtYXR0ZXIpKSB7XG4gICAgb3B0aW9ucyA9IGZvcm1hdHRlcjtcbiAgICBmb3JtYXR0ZXIgPSBpZGVudGl0eTtcbiAgfVxuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIGlmKCFvcHRpb25zLmhhc093blByb3BlcnR5KCdhZGRJZicpKSB7XG4gICAgb3B0aW9ucy5hZGRJZiA9ICgpID0+IHRydWU7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGNvbHVtbixcbiAgICBmaWVsZCxcbiAgICBmb3JtYXR0ZXIsXG4gICAgb3B0aW9uc1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgS25leENzdlRyYW5zZm9ybWVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgY29uc3RydWN0b3Ioa25leCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5vcHRzID0ge307XG4gICAgdGhpcy5rbmV4ID0ga25leDtcbiAgICB0aGlzLmhlYWRlcnMgPSBbXTtcbiAgICB0aGlzLnRyYW5zZm9ybWVycyA9IFtdO1xuICAgIHRoaXMucmVjb3JkcyA9IFtdO1xuICAgIHRoaXMucGFyc2VyID0gbnVsbDtcbiAgICB0aGlzLnF1ZXVlID0gbnVsbDtcbiAgICB0aGlzLnByb21pc2VzID0gW107XG4gICAgdGhpcy50cmFuc2Zvcm1lcnMgPSBbXTtcbiAgICB0aGlzLm9uUmVhZGFibGUgPSB0aGlzLm9uUmVhZGFibGUuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uRW5kID0gdGhpcy5vbkVuZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25TdWNjZWVkZWQgPSB0aGlzLm9uU3VjY2VlZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbkZhaWxlZCA9IHRoaXMub25GYWlsZWQuYmluZCh0aGlzKTtcbiAgfVxuXG4gIHN0YXRpYyBmcm9tS25leENsaWVudChrbmV4KSB7XG4gICAgcmV0dXJuIG5ldyBLbmV4Q3N2VHJhbnNmb3JtZXIoa25leCk7XG4gIH1cblxuICBtZXJnZU9wdGlvbnMob3B0aW9ucykge1xuICAgIGxldCBvcHRzID0gb3B0aW9ucyB8fCB7fTtcbiAgICBsZXQgZGVmYXVsdHMgPSB7XG4gICAgICBmaWxlOiBudWxsLFxuICAgICAgdGFibGU6IG51bGwsXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgcmVjb3Jkc1BlclF1ZXJ5OiAxMDAsXG4gICAgICBpZ25vcmVJZjogKCkgPT4gZmFsc2UsXG4gICAgICBwYXJzZXI6IHtcbiAgICAgICAgZGVsaW1pdGVyOiAnLCcsXG4gICAgICAgIHF1b3RlOiAnXCInLFxuICAgICAgICBlc2NhcGU6ICdcXFxcJyxcbiAgICAgICAgc2tpcF9lbXB0eV9saW5lczogdHJ1ZSxcbiAgICAgICAgYXV0b19wYXJzZTogdHJ1ZVxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gbWVyZ2Uoe30sIGRlZmF1bHRzLCBvcHRzKTtcbiAgfVxuXG4gIGdlbmVyYXRlKG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdHMgPSB0aGlzLm1lcmdlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIHRoaXMucGFyc2VyID0gcGFyc2UodGhpcy5vcHRzLnBhcnNlcik7XG4gICAgdGhpcy5wYXJzZXIub24oJ3JlYWRhYmxlJywgdGhpcy5vblJlYWRhYmxlKTtcbiAgICB0aGlzLnBhcnNlci5vbignZW5kJywgdGhpcy5vbkVuZCk7XG4gICAgdGhpcy5wYXJzZXIub24oJ2Vycm9yJywgdGhpcy5vbkZhaWxlZCk7XG5cbiAgICB0aGlzLnF1ZXVlID0gUHJvbWlzZS5iaW5kKHRoaXMpLnRoZW4oIHRoaXMuY3JlYXRlQ2xlYW5VcFF1ZXVlKCkgKTtcblxuICAgIHRoaXMuY3N2ID0gZnMuY3JlYXRlUmVhZFN0cmVhbSh0aGlzLm9wdHMuZmlsZSk7XG4gICAgdGhpcy5jc3YucGlwZSggaWNvbnYuZGVjb2RlU3RyZWFtKHRoaXMub3B0cy5lbmNvZGluZykgKS5waXBlKHRoaXMucGFyc2VyKTtcbiAgfVxuXG4gIG9uUmVhZGFibGUoKSB7XG4gICAgbGV0IHJlY29yZCA9IHRoaXMucGFyc2VyLnJlYWQoKTtcblxuICAgIGlmIChyZWNvcmQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5wYXJzZXIuY291bnQgPD0gMSkge1xuICAgICAgdGhpcy5oZWFkZXJzID0gcmVjb3JkO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZighdGhpcy5vcHRzLmlnbm9yZUlmKHJlY29yZCkpIHtcbiAgICAgICAgY29uc3QgcHJvbWlzZSA9IHRoaXMuY3JlYXRlT2JqZWN0RnJvbShyZWNvcmQpO1xuICAgICAgICB0aGlzLnByb21pc2VzLnB1c2goIHByb21pc2UgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkVuZCgpIHtcbiAgICBQcm9taXNlLmFsbCh0aGlzLnByb21pc2VzKS50aGVuKHZhbHVlcyA9PiB7XG4gICAgICBpZiAodmFsdWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy5xdWV1ZSA9IHRoaXMucXVldWUudGhlbiggdGhpcy5jcmVhdGVCdWxrSW5zZXJ0UXVldWUodmFsdWVzKSApO1xuICAgICAgfVxuICAgICAgdGhpcy5xdWV1ZS50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnZW5kJywgdGhpcy5yZXN1bHRzKTtcbiAgICAgIH0pLmNhdGNoKHRoaXMub25GYWlsZWQpO1xuICAgIH0pO1xuICB9XG5cbiAgY3JlYXRlQ2xlYW5VcFF1ZXVlKCkge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5rbmV4KHRoaXMub3B0cy50YWJsZSkuZGVsKClcbiAgICAgICAgLnRoZW4odGhpcy5vblN1Y2NlZWRlZClcbiAgICAgICAgLmNhdGNoKHRoaXMub25GYWlsZWQpO1xuICAgIH07XG4gIH1cblxuICBjcmVhdGVCdWxrSW5zZXJ0UXVldWUodmFsdWVzKSB7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmtuZXgodGhpcy5vcHRzLnRhYmxlKVxuICAgICAgICAuaW5zZXJ0KHZhbHVlcylcbiAgICAgICAgLnRoZW4odGhpcy5vblN1Y2NlZWRlZClcbiAgICAgICAgLmNhdGNoKHRoaXMub25GYWlsZWQpO1xuICAgIH07XG4gIH1cblxuICBjcmVhdGVPYmplY3RGcm9tKHJlY29yZCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCBvYmogPSB7fTtcblxuICAgICAgZm9yKGxldCBpID0gMCwgbCA9IHNlbGYub3B0cy50cmFuc2Zvcm1lcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGxldCB0cmFuc2Zvcm1lciA9IHNlbGYub3B0cy50cmFuc2Zvcm1lcnNbaV07XG5cbiAgICAgICAgY29uc3QgaGVhZGVySW5kZXggPSBmaW5kSW5kZXgoc2VsZi5oZWFkZXJzLCAoaGVhZGVyKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGhlYWRlciA9PT0gdHJhbnNmb3JtZXIuY29sdW1uO1xuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgY3N2VmFsdWUgPSByZWNvcmRbaGVhZGVySW5kZXhdO1xuXG4gICAgICAgIGlmKHRyYW5zZm9ybWVyLm9wdGlvbnMubG9va1VwKSB7XG4gICAgICAgICAgY29uc3QgbG9va1VwID0gdHJhbnNmb3JtZXIub3B0aW9ucy5sb29rVXA7XG5cbiAgICAgICAgICBjb25zdCB3aGVyZUNsYXVzZSA9IHt9O1xuXG4gICAgICAgICAgd2hlcmVDbGF1c2VbbG9va1VwLmNvbHVtbl0gPSBjc3ZWYWx1ZTtcblxuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlbGYua25leChsb29rVXAudGFibGUpLndoZXJlKHdoZXJlQ2xhdXNlKS5zZWxlY3QobG9va1VwLnNjYWxhcik7XG5cbiAgICAgICAgICBpZihyZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgICBjc3ZWYWx1ZSA9IHJlc3VsdFswXVtsb29rVXAuc2NhbGFyXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYobG9va1VwLmNyZWF0ZUlmTm90RXhpc3RzICYmIGxvb2tVcC5jcmVhdGVJZk5vdEVxdWFsKGNzdlZhbHVlKSkge1xuICAgICAgICAgICAgICBjb25zdCBpbnNlcnQgPSB7W2xvb2tVcC5jb2x1bW5dOiBjc3ZWYWx1ZX07XG5cbiAgICAgICAgICAgICAgY29uc3QgaW5zZXJ0ZWQgPSBhd2FpdCBzZWxmLmtuZXgobG9va1VwLnRhYmxlKVxuICAgICAgICAgICAgICAgICAgICAgIC5pbnNlcnQoaW5zZXJ0KVxuICAgICAgICAgICAgICAgICAgICAgIC5yZXR1cm5pbmcoJ2lkJyk7XG5cbiAgICAgICAgICAgICAgY3N2VmFsdWUgPSBpbnNlcnRlZFswXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB2YWx1ZSA9IHRyYW5zZm9ybWVyLmZvcm1hdHRlcihjc3ZWYWx1ZSwgcmVjb3JkLCBvYmopO1xuXG4gICAgICAgIGlmKCh2YWx1ZSAhPSB1bmRlZmluZWQgJiYgdmFsdWUgIT0gbnVsbCkgJiYgdHJhbnNmb3JtZXIub3B0aW9ucy5hZGRJZih2YWx1ZSkpIHtcbiAgICAgICAgICBvYmpbdHJhbnNmb3JtZXIuZmllbGRdID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc29sdmUob2JqKTtcbiAgICB9KTtcbiAgfVxuXG4gIG9uU3VjY2VlZGVkKHJlcykge1xuICAgIHRoaXMucHJvbWlzZXMucHVzaChyZXMpO1xuICB9XG5cbiAgb25GYWlsZWQoZXJyKSB7XG4gICAgY29uc29sZS5kaXIoZXJyKTtcbiAgICB0aGlzLmNzdi51bnBpcGUoKTtcbiAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgfVxufVxuIl19