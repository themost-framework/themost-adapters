'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PGSqlFormatter = exports.PGSqlAdapter = undefined;

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @license
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * MOST Web Framework 2.0 Codename Blueshift
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright (c) 2014, Kyriakos Barbounakis k.barbounakis@gmail.com
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *                     Anthi Oikonomou anthioikonomou@gmail.com
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Use of this source code is governed by an BSD-3-Clause license that can be
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * found in the LICENSE file at https://themost.io/license
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


exports.createInstance = createInstance;

var _pg = require('pg');

var pg = _interopRequireDefault(_pg).default;

var _async = require('async');

var async = _interopRequireDefault(_async).default;

var _util = require('util');

var util = _interopRequireDefault(_util).default;

var _lodash = require('lodash');

var _ = _interopRequireDefault(_lodash).default;

var _formatter = require('@themost/query/formatter');

var SqlFormatter = _formatter.SqlFormatter;

var _query = require('@themost/query/query');

var QueryExpression = _query.QueryExpression;
var QueryField = _query.QueryField;

var _utils = require('@themost/query/utils');

var SqlUtils = _utils.SqlUtils;

var _utils2 = require('@themost/common/utils');

var TraceUtils = _utils2.TraceUtils;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

pg.types.setTypeParser(20, function (val) {
    return val === null ? null : parseInt(val);
});

pg.types.setTypeParser(1700, function (val) {
    return val === null ? null : parseFloat(val);
});

/**
 * @class
 * @augments {DataAdapter}
 */

var PGSqlAdapter = exports.PGSqlAdapter = function () {
    /**
     * @constructor
     * @param {*} options
     */
    function PGSqlAdapter(options) {
        _classCallCheck(this, PGSqlAdapter);

        this.rawConnection = null;
        /**
         * @type {*}
         */
        this.transaction = null;
        /**
         * @type {*}
         */
        this.options = options || {};
        if (typeof this.options.port === 'undefined') this.options.port = 5432;
        if (typeof this.options.host === 'undefined') this.options.host = 'localhost';
        //define connection string
        var self = this;
        Object.defineProperty(this, 'connectionString', { get: function get() {
                return util.format('postgres://%s:%s@%s:%s/%s', self.options.user, self.options.password, self.options.host, self.options.port, self.options.database);
            }, enumerable: false, configurable: false });
    }

    /**
     * Opens a new database connection
     * @param {function(Error=)} callback
     */


    _createClass(PGSqlAdapter, [{
        key: 'connect',
        value: function connect(callback) {

            var self = this;
            callback = callback || function () {};
            if (self.rawConnection) {
                callback();
                return;
            }
            self.rawConnection = new pg.Client(this.connectionString);

            var startTime = void 0;
            if (process.env.NODE_ENV === 'development') {
                startTime = new Date().getTime();
            }
            //try to connection
            self.rawConnection.connect(function (err) {
                if (err) {
                    self.rawConnection = null;
                    return callback(err);
                }
                if (process.env.NODE_ENV === 'development') {
                    TraceUtils.log(util.format('SQL (Execution Time:%sms): Connect', new Date().getTime() - startTime));
                }
                //and return
                callback(err);
            });
        }

        /**
         * Opens a new database connection
         * @param {function(Error=)} callback
         */

    }, {
        key: 'open',
        value: function open(callback) {
            callback = callback || function () {};
            if (this.rawConnection) {
                return callback();
            }
            this.connect(callback);
        }

        /**
         * Closes the underlying database connection
         * @param {function(Error=)} callback
         */

    }, {
        key: 'disconnect',
        value: function disconnect(callback) {
            callback = callback || function () {};
            if (typeof this.rawConnection === 'undefined' || this.rawConnection === null) {
                callback();
                return;
            }
            try {
                //try to close connection
                this.rawConnection.end();
                if (this.rawConnection.connection && this.rawConnection.connection.stream) {
                    if (typeof this.rawConnection.connection.stream.destroy === 'function') {
                        this.rawConnection.connection.stream.destroy();
                    }
                }
                this.rawConnection = null;
                callback();
            } catch (e) {
                TraceUtils.log('An error occurred while trying to close database connection. ' + e.message);
                this.rawConnection = null;
                //do nothing (do not raise an error)
                callback();
            }
        }

        /**
         * Closes the underlying database connection
         * @param {function(Error=)} callback
         */

    }, {
        key: 'close',
        value: function close(callback) {
            callback = callback || function () {};
            this.disconnect(callback);
        }

        /**
         * @param {string} query
         * @param {*=} values
         */

    }, {
        key: 'prepare',
        value: function prepare(query, values) {
            return SqlUtils.format(query, values);
        }

        /**
         * Executes a query against the underlying database
         * @param {string|*} query
         * @param values {*=}
         * @param {function(Error=,*=)} callback
         */

    }, {
        key: 'execute',
        value: function execute(query, values, callback) {
            var self = this;
            var sql = null;
            try {

                if (typeof query === 'string') {
                    //get raw sql statement
                    sql = query;
                } else {
                    //format query expression or any object that may be act as query expression
                    var formatter = new PGSqlFormatter();
                    sql = formatter.format(query);
                }
                //validate sql statement
                if (typeof sql !== 'string') {
                    callback.call(self, new Error('The executing command is of the wrong type or empty.'));
                    return;
                }
                //ensure connection
                self.open(function (err) {
                    if (err) {
                        callback.call(self, err);
                    } else {
                        //log statement (optional)
                        var startTime = void 0;
                        var prepared = self.prepare(sql, values);
                        if (process.env.NODE_ENV === 'development') {
                            startTime = new Date().getTime();
                        }
                        //execute raw command
                        self.rawConnection.query(prepared, null, function (err, result) {
                            if (process.env.NODE_ENV === 'development') {
                                TraceUtils.log(util.format('SQL (Execution Time:%sms):%s, Parameters:%s', new Date().getTime() - startTime, prepared, JSON.stringify(values)));
                            }
                            if (err) {
                                //log sql
                                TraceUtils.log(util.format('SQL Error:%s', prepared));
                                callback(err);
                            } else {
                                callback(null, result.rows);
                            }
                        });
                    }
                });
            } catch (e) {
                callback.call(self, e);
            }
        }
    }, {
        key: 'lastIdentity',
        value: function lastIdentity(callback) {
            var self = this;
            self.open(function (err) {
                if (err) {
                    callback(err);
                } else {
                    //execute lastval (for sequence)
                    self.rawConnection.query('SELECT lastval()', null, function (err, lastval) {
                        if (err) {
                            callback(null, { insertId: null });
                        } else {
                            lastval.rows = lastval.rows || [];
                            if (lastval.rows.length > 0) callback(null, { insertId: lastval.rows[0]['lastval'] });else callback(null, { insertId: null });
                        }
                    });
                }
            });
        }

        /**
         * Begins a database transaction and executes the given function
         * @param {function(Error=)} fn
         * @param {function(Error=)} callback
         */

    }, {
        key: 'executeInTransaction',
        value: function executeInTransaction(fn, callback) {
            var self = this;
            //ensure parameters
            fn = fn || function () {};callback = callback || function () {};
            self.open(function (err) {
                if (err) {
                    callback(err);
                } else {
                    if (self.transaction) {
                        fn.call(self, function (err) {
                            callback(err);
                        });
                    } else {
                        //begin transaction
                        self.rawConnection.query('BEGIN TRANSACTION;', null, function (err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            //initialize dummy transaction object (for future use)
                            self.transaction = {};
                            //execute function
                            fn.call(self, function (err) {
                                if (err) {
                                    //rollback transaction
                                    self.rawConnection.query('ROLLBACK TRANSACTION;', null, function () {
                                        self.transaction = null;
                                        callback(err);
                                    });
                                } else {
                                    //commit transaction
                                    self.rawConnection.query('COMMIT TRANSACTION;', null, function (err) {
                                        self.transaction = null;
                                        callback(err);
                                    });
                                }
                            });
                        });
                    }
                }
            });
        }

        /**
         * Produces a new identity value for the given entity and attribute.
         * @param entity {String} The target entity name
         * @param attribute {String} The target attribute
         * @param callback {Function=}
         */

    }, {
        key: 'selectIdentity',
        value: function selectIdentity(entity, attribute, callback) {

            var self = this;

            var migration = {
                appliesTo: 'increment_id',
                model: 'increments',
                description: 'Increments migration (version 1.0)',
                version: '1.0',
                add: [{ name: 'id', type: 'Counter', primary: true }, { name: 'entity', type: 'Text', size: 120 }, { name: 'attribute', type: 'Text', size: 120 }, { name: 'value', type: 'Integer' }]
            };
            //ensure increments entity
            self.migrate(migration, function (err) {
                //throw error if any
                if (err) {
                    callback.call(self, err);return;
                }
                self.execute('SELECT * FROM increment_id WHERE entity=? AND attribute=?', [entity, attribute], function (err, result) {
                    if (err) {
                        callback.call(self, err);return;
                    }
                    if (result.length === 0) {
                        //get max value by querying the given entity
                        var q = new QueryExpression().from(entity).select([new QueryField().max(attribute)]);
                        self.execute(q, null, function (err, result) {
                            if (err) {
                                return callback.call(self, err);
                            }
                            var value = 1;
                            if (result.length > 0) {
                                value = parseInt(result[0][attribute]) + 1;
                            }
                            self.execute('INSERT INTO increment_id(entity, attribute, value) VALUES (?,?,?)', [entity, attribute, value], function (err) {
                                //throw error if any
                                if (err) {
                                    return callback.call(self, err);
                                }
                                //return new increment value
                                callback.call(self, err, value);
                            });
                        });
                    } else {
                        //get new increment value
                        var value = parseInt(result[0].value) + 1;
                        self.execute('UPDATE increment_id SET value=? WHERE id=?', [value, result[0].id], function (err) {
                            //throw error if any
                            if (err) {
                                return callback.call(self, err);
                            }
                            //return new increment value
                            callback.call(self, err, value);
                        });
                    }
                });
            });
        }

        /**
         * Executes an operation against database and returns the results.
         * @param {DataModelBatch} batch
         * @param {Function} callback
         * @deprecated DataAdapter.executeBatch() is obsolete. Use DataAdapter.executeInTransaction() instead.
         */

    }, {
        key: 'executeBatch',
        value: function executeBatch(batch, callback) {
            callback = callback || function () {};
            callback(new Error('DataAdapter.executeBatch() is obsolete. Use DataAdapter.executeInTransaction() instead.'));
        }

        /**
         *
         * @param {*|{type:string, size:number, nullable:boolean}} field
         * @param {string=} format
         * @returns {string}
         */

    }, {
        key: 'refreshView',
        value: function refreshView(name, query, callback) {
            var formatter = new PGSqlFormatter();
            this.execute('REFRESH MATERIALIZED VIEW ' + formatter.escapeName(name), null, function (err) {
                callback(err);
            });
        }

        /**
         * @param query {QueryExpression}
         */

    }, {
        key: 'createView',
        value: function createView(name, query, callback) {
            var self = this;
            //open database
            self.open(function (err) {
                if (err) {
                    callback.call(self, err);
                    return;
                }
                //begin transaction
                self.executeInTransaction(function (tr) {
                    async.waterfall([function (cb) {
                        self.execute('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\'public\' AND table_type=\'VIEW\' AND table_name=?', [name], function (err, result) {
                            if (err) {
                                throw err;
                            }
                            if (result.length === 0) return cb(null, 0);
                            cb(null, result[0].count);
                        });
                    }, function (arg, cb) {
                        if (arg === 0) {
                            cb(null, 0);return;
                        }
                        //format query
                        var sql = util.format("DROP VIEW \"%s\"", name);
                        self.execute(sql, null, function (err) {
                            if (err) {
                                throw err;
                            }
                            cb(null, 0);
                        });
                    }, function (arg, cb) {
                        //format query
                        var formatter = new PGSqlFormatter();
                        formatter.settings.nameFormat = PGSqlAdapter.NAME_FORMAT;
                        var sql = util.format("CREATE VIEW \"%s\" AS %s", name, formatter.format(query));
                        self.execute(sql, null, function (err) {
                            if (err) {
                                throw err;
                            }
                            cb(null, 0);
                        });
                    }], function (err) {
                        if (err) {
                            tr(err);return;
                        }
                        tr(null);
                    });
                }, function (err) {
                    callback(err);
                });
            });
        }

        /**
         * @class DataModelMigration
         * @property {string} name
         * @property {string} description
         * @property {string} model
         * @property {string} appliesTo
         * @property {string} version
         * @property {array} add
         * @property {array} remove
         * @property {array} change
         */
        /**
         * @param {string} name
         * @returns {{exists: Function}}
         */

    }, {
        key: 'table',
        value: function table(name) {
            var self = this;
            return {
                /**
                 * @param {function(Error,Boolean=)} callback
                 */
                exists: function exists(callback) {
                    callback = callback || function () {};
                    self.execute('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\'public\' AND table_type=\'BASE TABLE\' AND table_name=?', [name], function (err, result) {
                        if (err) {
                            callback(err);return;
                        }
                        callback(null, result[0].count > 0);
                    });
                },
                /**
                 * @param {function(Error,string=)} callback
                 */
                version: function version(callback) {
                    self.execute('SELECT MAX("version") AS version FROM migrations WHERE "appliesTo"=?', [name], function (err, result) {
                        if (err) {
                            callback(err);return;
                        }
                        if (result.length === 0) callback(null, '0.0');else callback(null, result[0].version || '0.0');
                    });
                },
                /**
                 * @param {function(Error,Boolean=)} callback
                 */
                has_sequence: function has_sequence(callback) {
                    callback = callback || function () {};
                    self.execute('SELECT COUNT(*) FROM information_schema.columns WHERE table_name=? AND table_schema=\'public\' AND ("column_default" ~ \'^nextval\\((.*?)\\)$\')', [name], function (err, result) {
                        if (err) {
                            callback(err);return;
                        }
                        callback(null, result[0].count > 0);
                    });
                },
                /**
                 * @param {function(Error,{columnName:string,ordinal:number,dataType:*, maxLength:number,isNullable:number }[]=)} callback
                 */
                columns: function columns(callback) {
                    callback = callback || function () {};
                    self.execute('SELECT column_name AS "columnName", ordinal_position as "ordinal", data_type as "dataType",' + 'character_maximum_length as "maxLength", is_nullable AS  "isNullable", column_default AS "defaultValue"' + ' FROM information_schema.columns WHERE table_name=?', [name], function (err, result) {
                        if (err) {
                            callback(err);return;
                        }
                        callback(null, result);
                    });
                }
            };
        }

        /*
        * @param obj {DataModelMigration|*} An Object that represents the data model scheme we want to migrate
        * @param callback {Function}
        */

    }, {
        key: 'migrate',
        value: function migrate(obj, callback) {
            if (obj === null) return;
            var self = this;
            /**
             * @type {DataModelMigration|*}
             */
            var migration = obj;

            var format = function format(_format, obj) {
                var result = _format;
                if (/%t/.test(_format)) result = result.replace(/%t/g, PGSqlAdapter.formatType(obj));
                if (/%f/.test(_format)) result = result.replace(/%f/g, obj.name);
                return result;
            };

            if (migration.appliesTo === null) throw new Error("Model name is undefined");
            self.open(function (err) {
                if (err) {
                    callback.call(self, err);
                } else {
                    async.waterfall([
                    //1. Check migrations table existence
                    function (cb) {
                        if (PGSqlAdapter.supportMigrations) {
                            cb(null, 1);
                            return;
                        }
                        self.table('migrations').exists(function (err, exists) {
                            if (err) {
                                cb(err);return;
                            }
                            cb(null, exists);
                        });
                    },
                    //2. Create migrations table if not exists
                    function (arg, cb) {
                        if (arg > 0) {
                            cb(null, 0);return;
                        }
                        //create migrations table
                        self.execute('CREATE TABLE migrations(id SERIAL NOT NULL, ' + '"appliesTo" varchar(80) NOT NULL, "model" varchar(120) NULL, "description" varchar(512),"version" varchar(40) NOT NULL)', ['migrations'], function (err) {
                            if (err) {
                                cb(err);return;
                            }
                            PGSqlAdapter.supportMigrations = true;
                            cb(null, 0);
                        });
                    },
                    //3. Check if migration has already been applied
                    function (arg, cb) {
                        self.table(migration.appliesTo).version(function (err, version) {
                            if (err) {
                                cb(err);return;
                            }
                            cb(null, version >= migration.version);
                        });
                    },
                    //4a. Check table existence
                    function (arg, cb) {
                        //migration has already been applied (set migration.updated=true)
                        if (arg) {
                            obj['updated'] = true;
                            return cb(null, -1);
                        } else {
                            self.table(migration.appliesTo).exists(function (err, exists) {
                                if (err) {
                                    cb(err);return;
                                }
                                cb(null, exists ? 1 : 0);
                            });
                        }
                    },
                    //4b. Get table columns
                    function (arg, cb) {
                        //migration has already been applied
                        if (arg < 0) {
                            cb(null, [arg, null]);return;
                        }
                        self.table(migration.appliesTo).columns(function (err, columns) {
                            if (err) {
                                cb(err);return;
                            }
                            cb(null, [arg, columns]);
                        });
                    },
                    //5. Migrate target table (create or alter)
                    function (args, cb) {
                        //migration has already been applied
                        if (args[0] < 0) {
                            cb(null, args[0]);return;
                        }
                        var columns = args[1];
                        if (args[0] === 0) {
                            //create table and
                            var strFields = _.map(_.filter(migration.add, function (x) {
                                return !x.oneToMany;
                            }), function (x) {
                                return format('"%f" %t', x);
                            }).join(', ');
                            var key = _.find(migration.add, function (x) {
                                return x.primary;
                            });
                            var sql = util.format('CREATE TABLE "%s" (%s, PRIMARY KEY("%s"))', migration.appliesTo, strFields, key.name);
                            self.execute(sql, null, function (err) {
                                if (err) {
                                    return cb(err);
                                }
                                return cb(null, 1);
                            });
                        } else {
                            var expressions = [];
                            var column = void 0;
                            var fname = void 0;
                            var findColumnFunc = function findColumnFunc(name) {
                                return _.find(columns, function (x) {
                                    return x.columnName === name;
                                });
                            };
                            //1. enumerate fields to delete
                            if (migration.remove) {
                                for (var i = 0; i < migration.remove.length; i++) {
                                    fname = migration.remove[i].name;
                                    column = findColumnFunc(fname);
                                    if (typeof column !== 'undefined') {
                                        var k = 1,
                                            deletedColumnName = util.format('xx%s1_%s', k.toString(), column.columnName);
                                        while (typeof findColumnFunc(deletedColumnName) !== 'undefined') {
                                            k += 1;
                                            deletedColumnName = util.format('xx%s_%s', k.toString(), column.columnName);
                                        }
                                        expressions.push(util.format('ALTER TABLE "%s" RENAME COLUMN "%s" TO %s', migration.appliesTo, column.columnName, deletedColumnName));
                                    }
                                }
                            }
                            //2. enumerate fields to add
                            var newSize = void 0,
                                originalSize = void 0,
                                fieldName = void 0,
                                nullable = void 0;
                            if (migration.add) {
                                for (var _i = 0; _i < migration.add.length; _i++) {
                                    //get field name
                                    fieldName = migration.add[_i].name;
                                    //check if field exists or not
                                    column = findColumnFunc(fieldName);
                                    if (typeof column !== 'undefined') {
                                        //get original field size
                                        originalSize = column.maxLength;
                                        //and new field size
                                        newSize = migration.add[_i].size;
                                        //add expression for modifying column (size)
                                        if (typeof newSize !== 'undefined' && originalSize !== newSize) {
                                            expressions.push(util.format('UPDATE pg_attribute SET atttypmod = %s+4 WHERE attrelid = \'"%s"\'::regclass AND attname = \'%s\';', newSize, migration.appliesTo, fieldName));
                                        }
                                        //update nullable attribute
                                        nullable = typeof migration.add[_i].nullable !== 'undefined' ? migration.add[_i].nullable : true;
                                        expressions.push(util.format('ALTER TABLE "%s" ALTER COLUMN "%s" %s', migration.appliesTo, fieldName, nullable ? 'DROP NOT NULL' : 'SET NOT NULL'));
                                    } else {
                                        //add expression for adding column
                                        expressions.push(util.format('ALTER TABLE "%s" ADD COLUMN "%s" %s', migration.appliesTo, fieldName, PGSqlAdapter.formatType(migration.add[_i])));
                                    }
                                }
                            }

                            //3. enumerate fields to update
                            if (migration.change) {
                                for (var _i2 = 0; _i2 < migration.change.length; _i2++) {
                                    var change = migration.change[_i2];
                                    column = findColumnFunc(change);
                                    if (typeof column !== 'undefined') {
                                        //important note: Alter column operation is not supported for column types
                                        expressions.push(util.format('ALTER TABLE "%s" ALTER COLUMN "%s" TYPE %s', migration.appliesTo, migration.add[_i2].name, PGSqlAdapter.formatType(migration.change[_i2])));
                                    }
                                }
                            }

                            if (expressions.length > 0) {
                                self.execute(expressions.join(';'), null, function (err) {
                                    if (err) {
                                        cb(err);return;
                                    }
                                    return cb(null, 1);
                                });
                            } else cb(null, 2);
                        }
                    }, function (arg, cb) {

                        if (arg > 0) {
                            //log migration to database
                            self.execute('INSERT INTO migrations("appliesTo", "model", "version", "description") VALUES (?,?,?,?)', [migration.appliesTo, migration.model, migration.version, migration.description], function (err) {
                                if (err) throw err;
                                return cb(null, 1);
                            });
                        } else {
                            migration['updated'] = true;
                            cb(null, arg);
                        }
                    }], function (err, result) {
                        callback(err, result);
                    });
                }
            });
        }
    }], [{
        key: 'formatType',
        value: function formatType(field, format) {
            var size = parseInt(field.size);
            var scale = parseInt(field.scale);
            var s = 'varchar(512) NULL';
            var type = field.type;
            switch (type) {
                case 'Boolean':
                    s = 'boolean';
                    break;
                case 'Byte':
                    s = 'smallint';
                    break;
                case 'Number':
                case 'Float':
                    s = 'real';
                    break;
                case 'Counter':
                    return 'SERIAL';
                case 'Currency':
                case 'Decimal':
                    s = util.format('decimal(%s,%s)', size > 0 ? size : 19, scale > 0 ? scale : 4);
                    break;
                case 'Date':
                    s = 'date';
                    break;
                case 'DateTime':
                    s = 'timestamp';
                    break;
                case 'Time':
                    s = 'time';
                    break;
                case 'Integer':
                    s = 'int';
                    break;
                case 'Duration':
                    s = size > 0 ? util.format('varchar(%s)', size) : 'varchar(48)';
                    break;
                case 'URL':
                    if (size > 0) s = util.format('varchar(%s)', size);else s = 'varchar';
                    break;
                case 'Text':
                    if (size > 0) s = util.format('varchar(%s)', size);else s = 'varchar';
                    break;
                case 'Note':
                    if (size > 0) s = util.format('varchar(%s)', size);else s = 'text';
                    break;
                case 'Image':
                case 'Binary':
                    s = size > 0 ? util.format('bytea(%s)', size) : 'bytea';
                    break;
                case 'Guid':
                    s = 'uuid';
                    break;
                case 'Short':
                    s = 'smallint';
                    break;
                default:
                    s = 'integer';
                    break;
            }
            if (format === 'alter') s += typeof field.nullable === 'undefined' ? ' DROP NOT NULL' : field.nullable ? ' DROP NOT NULL' : ' SET NOT NULL';else s += typeof field.nullable === 'undefined' ? ' NULL' : field.nullable ? ' NULL' : ' NOT NULL';
            return s;
        }
    }]);

    return PGSqlAdapter;
}();

PGSqlAdapter.NAME_FORMAT = '"$1"';

/**
 * @class
 * @augments {SqlFormatter}
 */

var PGSqlFormatter = exports.PGSqlFormatter = function (_SqlFormatter) {
    _inherits(PGSqlFormatter, _SqlFormatter);

    /**
     * @constructor
     */
    function PGSqlFormatter() {
        _classCallCheck(this, PGSqlFormatter);

        var _this = _possibleConstructorReturn(this, (PGSqlFormatter.__proto__ || Object.getPrototypeOf(PGSqlFormatter)).call(this));

        _this.settings = {
            nameFormat: PGSqlAdapter.NAME_FORMAT
        };
        return _this;
    }

    /**
     *
     * @param {QueryExpression|{$take:number=,$skip:number=}} obj
     * @returns {string}
     */


    _createClass(PGSqlFormatter, [{
        key: 'formatLimitSelect',
        value: function formatLimitSelect(obj) {
            var sql = this.formatSelect(obj);
            if (obj.$take) {
                if (obj.$skip)
                    //add limit and skip records
                    sql = sql.concat(' LIMIT ', obj.$take.toString(), ' OFFSET ', obj.$skip.toString());else
                    //add only limit
                    sql = sql.concat(' LIMIT ', obj.$take.toString());
            }
            return sql;
        }
    }, {
        key: 'escapeConstant',
        value: function escapeConstant(obj, quoted) {
            var res = this.escape(obj, quoted);
            if (typeof obj === 'undefined' || obj === null) res += '::text';else if (obj instanceof Date) res += '::timestamp';else if (typeof obj === 'number') res += '::float';else if (typeof obj === 'boolean') res += '::bool';else res += '::text';
            return res;
        }

        /**
         * Escapes an object or a value and returns the equivalent sql value.
         * @param {*} value - A value that is going to be escaped for SQL statements
         * @param {boolean=} unquoted - An optional value that indicates whether the resulted string will be quoted or not.
         * @returns {string} - The equivalent SQL string value
         */

    }, {
        key: 'escape',
        value: function escape(value, unquoted) {
            var res = _get(PGSqlFormatter.prototype.__proto__ || Object.getPrototypeOf(PGSqlFormatter.prototype), 'escape', this).bind(this)(value, unquoted);
            if (typeof value === 'string') {
                if (/\\'/g.test(res)) res = res.replace(/\\'/g, SINGLE_QUOTE_ESCAPE);
                if (/\\"/g.test(res)) res = res.replace(/\\"/g, DOUBLE_QUOTE_ESCAPE);
            }
            return res;
        }

        /**
         * Implements indexOf(str,substr) expression formatter.
         * @param {String} p0 The source string
         * @param {String} p1 The string to search for
         */

    }, {
        key: '$indexof',
        value: function $indexof(p0, p1) {

            return util.format('POSITION(lower(%s) IN lower(%s::text))', this.escape(p1), this.escape(p0));
        }

        /**
         * Implements regular expression formatting.
         * @param {*} p0 - An object or string that represents the field which is going to be used in this expression.
         * @param {string|*} p1 - A string that represents the text to search for
         * @returns {string}
         */

    }, {
        key: '$regex',
        value: function $regex(p0, p1) {
            //validate params
            if (Object.isNullOrUndefined(p0) || Object.isNullOrUndefined(p1)) return '';
            return util.format('(%s ~ \'%s\')', this.escape(p0), this.escape(p1, true));
        }

        /**
         * Implements startsWith(a,b) expression formatter.
         * @param p0 {*}
         * @param p1 {*}
         */

    }, {
        key: '$startswith',
        value: function $startswith(p0, p1) {
            //validate params
            if (Object.isNullOrUndefined(p0) || Object.isNullOrUndefined(p1)) return '';
            return util.format('(%s ~ \'^%s\')', this.escape(p0), this.escape(p1, true));
        }

        /**
         * Implements endsWith(a,b) expression formatter.
         * @param p0 {*}
         * @param p1 {*}
         */

    }, {
        key: '$endswith',
        value: function $endswith(p0, p1) {
            //validate params
            if (Object.isNullOrUndefined(p0) || Object.isNullOrUndefined(p1)) return '';
            var result = util.format('(%s ~ \'%s$$\')', this.escape(p0), this.escape(p1, true));
            return result;
        }

        /**
         * Implements substring(str,pos) expression formatter.
         * @param {String} p0 The source string
         * @param {Number} pos The starting position
         * @param {Number=} length The length of the resulted string
         * @returns {string}
         */

    }, {
        key: '$substring',
        value: function $substring(p0, pos, length) {
            if (length) return util.format('SUBSTRING(%s FROM %s FOR %s)', this.escape(p0), pos.valueOf() + 1, length.valueOf());else return util.format('SUBSTRING(%s FROM %s)', this.escape(p0), pos.valueOf() + 1);
        }

        /**
         * Implements contains(a,b) expression formatter.
         * @param p0 {*}
         * @param p1 {*}
         */

    }, {
        key: '$contains',
        value: function $contains(p0, p1) {
            //validate params
            if (Object.isNullOrUndefined(p0) || Object.isNullOrUndefined(p1)) return '';
            if (p1.valueOf().toString().length === 0) return '';
            return util.format('(%s ~ \'%s\')', this.escape(p0), this.escape(p1, true));
        }
    }, {
        key: 'escapeName',
        value: function escapeName(name) {
            if (typeof name === 'string') return name.replace(/(\w+)/ig, this.settings.nameFormat);
            return name;
        }

        /**
         * Implements length(a) expression formatter.
         * @param p0 {*}
         */

    }, {
        key: '$length',
        value: function $length(p0) {
            return util.format('LENGTH(%s)', this.escape(p0));
        }
    }, {
        key: '$day',
        value: function $day(p0) {
            return util.format('DATE_PART(\'day\',%s)', this.escape(p0));
        }
    }, {
        key: '$month',
        value: function $month(p0) {
            return util.format('DATE_PART(\'month\',%s)', this.escape(p0));
        }
    }, {
        key: '$year',
        value: function $year(p0) {
            return util.format('DATE_PART(\'year\',%s)', this.escape(p0));
        }
    }, {
        key: '$hour',
        value: function $hour(p0) {
            return util.format('HOUR_TZ(%s::timestamp with time zone)', this.escape(p0));
        }
    }, {
        key: '$minute',
        value: function $minute(p0) {
            return util.format('DATE_PART(\'minute\',%s)', this.escape(p0));
        }
    }, {
        key: '$second',
        value: function $second(p0) {
            return util.format('DATE_PART(\'second\',%s)', this.escape(p0));
        }
    }, {
        key: '$date',
        value: function $date(p0) {
            return util.format('CAST(%s AS DATE)', this.escape(p0));
        }
    }]);

    return PGSqlFormatter;
}(SqlFormatter);

var SINGLE_QUOTE_ESCAPE = '\'\'',
    DOUBLE_QUOTE_ESCAPE = '"';
/**
 * Implements text search expression formatting.
 * @param {*} p0 - An object or string that represents the field which is going to be used in this expression.
 * @param {string|*} p1 - A string that represents the text to search for
 * @returns {string}
 */
PGSqlFormatter.prototype.$text = PGSqlFormatter.prototype.$regex;

/**
 * Creates an instance of PGSqlAdapter object that represents a Postgres database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {DataAdapter}
 */
function createInstance(options) {
    return new PGSqlAdapter(options);
}
//# sourceMappingURL=index.js.map
