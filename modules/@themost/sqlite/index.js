'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.SqliteFormatter = exports.SqliteAdapter = undefined;

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

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

var _async = require('async');

var async = _interopRequireDefault(_async).default;

var _lodash = require('lodash');

var _ = _interopRequireDefault(_lodash).default;

var _util = require('util');

var util = _interopRequireDefault(_util).default;

var _sqlite = require('sqlite3');

var sqlite = _interopRequireDefault(_sqlite).default;

var _common = require('@themost/common');

var TraceUtils = _common.TraceUtils;

var _query = require('@themost/query');

var QueryExpression = _query.QueryExpression;
var QueryField = _query.QueryField;
var SqlUtils = _query.SqlUtils;
var SqlFormatter = _query.SqlFormatter;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var sqlite3 = sqlite.verbose();

/**
 * @class
 * @augments DataAdapter
 * @param {*} options
 * @constructor
 */

var SqliteAdapter = exports.SqliteAdapter = function () {
    function SqliteAdapter(options) {
        _classCallCheck(this, SqliteAdapter);

        /**
         * @type {{database: string}}
         */
        this.options = options || { database: ':memory:' };
        /**
         * Represents the database raw connection associated with this adapter
         * @type {*}
         */
        this.rawConnection = null;
    }

    _createClass(SqliteAdapter, [{
        key: 'open',
        value: function open(callback) {
            var self = this;
            callback = callback || function () {};
            if (self.rawConnection) {
                callback();
            } else {
                //try to open or create database
                self.rawConnection = new sqlite3.Database(self.options.database, 6, function (err) {
                    if (err) {
                        self.rawConnection = null;
                    }
                    callback(err);
                });
            }
        }
    }, {
        key: 'close',
        value: function close(callback) {
            var self = this;
            callback = callback || function () {};
            try {
                if (self.rawConnection) {
                    //close connection
                    self.rawConnection.close(function () {
                        //and finally return
                        callback();
                    });
                } else {
                    callback();
                }
            } catch (err) {
                TraceUtils.log('An error occured while closing database.');
                TraceUtils.log(err);
                //call callback without error
                callback();
            }
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
    }, {
        key: 'executeInTransaction',


        /**
         * Begins a transactional operation by executing the given function
         * @param fn {function} The function to execute
         * @param callback {function(Error=)} The callback that contains the error -if any- and the results of the given operation
         */
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
                        self.rawConnection.run('BEGIN TRANSACTION;', undefined, function (err) {
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
                                    self.rawConnection.run('ROLLBACK;', undefined, function () {
                                        self.transaction = null;
                                        callback(err);
                                    });
                                } else {
                                    //commit transaction
                                    self.rawConnection.run('COMMIT;', undefined, function (err) {
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
         *
         * @param {string} name
         * @param {QueryExpression|*} query
         * @param {function(Error=)} callback
         */

    }, {
        key: 'createView',
        value: function createView(name, query, callback) {
            this.view(name).create(query, callback);
        }

        /*
         * @param {DataModelMigration|*} obj An Object that represents the data model scheme we want to migrate
         * @param {function(Error=)} callback
         */

    }, {
        key: 'migrate',
        value: function migrate(obj, callback) {
            var self = this;
            callback = callback || function () {};
            if (_.isNil(obj)) {
                return callback();
            }
            /**
             * @type {DataModelMigration|*}
             */
            var migration = obj;

            var format = function format(_format, obj) {
                var result = _format;
                if (/%t/.test(_format)) result = result.replace(/%t/g, SqliteAdapter.formatType(obj));
                if (/%f/.test(_format)) result = result.replace(/%f/g, obj.name);
                return result;
            };

            async.waterfall([
            //1. Check migrations table existence
            function (cb) {
                if (SqliteAdapter.supportMigrations) {
                    cb(null, true);
                    return;
                }
                self.table('migrations').exists(function (err, exists) {
                    if (err) {
                        cb(err);return;
                    }
                    cb(null, exists);
                });
            },
            //2. Create migrations table, if it does not exist
            function (arg, cb) {
                if (arg) {
                    cb(null, 0);return;
                }
                //create migrations table
                self.execute('CREATE TABLE migrations("id" INTEGER PRIMARY KEY AUTOINCREMENT, ' + '"appliesTo" TEXT NOT NULL, "model" TEXT NULL, "description" TEXT,"version" TEXT NOT NULL)', [], function (err) {
                    if (err) {
                        cb(err);return;
                    }
                    SqliteAdapter.supportMigrations = true;
                    cb(null, 0);
                });
            },
            //3. Check if migration has already been applied (true=Table version is equal to migration version, false=Table version is older from migration version)
            function (arg, cb) {
                self.table(migration.appliesTo).version(function (err, version) {
                    if (err) {
                        cb(err);return;
                    }
                    cb(null, version >= migration.version);
                });
            },
            //4a. Check table existence (-1=Migration has already been applied, 0=Table does not exist, 1=Table exists)
            function (arg, cb) {
                //migration has already been applied (set migration.updated=true)
                if (arg) {
                    migration.updated = true;
                    cb(null, -1);
                } else {
                    self.table(migration.appliesTo).exists(function (err, exists) {
                        if (err) {
                            cb(err);return;
                        }
                        cb(null, exists ? 1 : 0);
                    });
                }
            },
            //4. Get table columns
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
                //migration has already been applied (args[0]=-1)
                if (args[0] < 0) {
                    cb(null, args[0]);
                } else if (args[0] === 0) {
                    //create table
                    var strFields = migration.add.filter(function (x) {
                        return !x['oneToMany'];
                    }).map(function (x) {
                        return format('"%f" %t', x);
                    }).join(', ');
                    var sql = util.format('CREATE TABLE "%s" (%s)', migration.appliesTo, strFields);
                    self.execute(sql, null, function (err) {
                        if (err) {
                            cb(err);return;
                        }
                        cb(null, 1);
                    });
                } else if (args[0] === 1) {
                    var expressions = [];

                    var /**
                        * @type {{columnName:string,ordinal:number,dataType:*, maxLength:number,isNullable:number,,primary:boolean }[]}
                        */
                    columns = args[1];

                    var forceAlter = false;
                    var column = void 0;
                    var newType = void 0;
                    var oldType = void 0;
                    //validate operations

                    //1. columns to be removed
                    if (Array.isArray(migration.remove)) {
                        if (migration.remove > 0) {
                            var _loop = function _loop(_i) {
                                var x = migration.remove[_i];
                                var colIndex = _.findIndex(columns, function (y) {
                                    return y.name === x.name;
                                });
                                if (colIndex >= 0) {
                                    if (!columns[colIndex].primary) {
                                        forceAlter = true;
                                    } else {
                                        migration.remove.splice(_i, 1);
                                        _i -= 1;
                                    }
                                } else {
                                    migration.remove.splice(_i, 1);
                                    _i -= 1;
                                }
                                i = _i;
                            };

                            for (var i = 0; i < migration.remove.length; i++) {
                                _loop(i);
                            }
                        }
                    }
                    //1. columns to be changed
                    if (Array.isArray(migration.change)) {
                        if (migration.change > 0) {
                            var _loop2 = function _loop2(_i3) {
                                var x = migration.change[_i3];
                                column = _.find(columns, function (y) {
                                    return y.name === x.name;
                                });
                                if (column) {
                                    if (!column.primary) {
                                        //validate new column type (e.g. TEXT(120,0) NOT NULL)
                                        newType = format('%t', x);oldType = column.type.toUpperCase().concat(column.nullable ? ' NOT NULL' : ' NULL');
                                        if (newType !== oldType) {
                                            //force alter
                                            forceAlter = true;
                                        }
                                    } else {
                                        //remove column from change collection (because it's a primary key)
                                        migration.change.splice(_i3, 1);
                                        _i3 -= 1;
                                    }
                                } else {
                                    //add column (column was not found in table)
                                    migration.add.push(x);
                                    //remove column from change collection
                                    migration.change.splice(_i3, 1);
                                    _i3 -= 1;
                                }

                                _i2 = _i3;
                            };

                            for (var _i2 = 0; _i2 < migration.change.length; _i2++) {
                                _loop2(_i2);
                            }
                        }
                    }
                    if (Array.isArray(migration.add)) {
                        var _loop3 = function _loop3(_i5) {
                            var x = migration.add[_i5];
                            column = _.find(columns, function (y) {
                                return y.name === x.name;
                            });
                            if (column) {
                                if (column.primary) {
                                    migration.add.splice(_i5, 1);
                                    _i5 -= 1;
                                } else {
                                    newType = format('%t', x);oldType = column.type.toUpperCase().concat(column.nullable ? ' NOT NULL' : ' NULL');
                                    if (newType === oldType) {
                                        //remove column from add collection
                                        migration.add.splice(_i5, 1);
                                        _i5 -= 1;
                                    } else {
                                        forceAlter = true;
                                    }
                                }
                            }
                            _i4 = _i5;
                        };

                        for (var _i4 = 0; _i4 < migration.add.length; _i4++) {
                            _loop3(_i4);
                        }
                        if (forceAlter) {
                            cb(new Error('Full table migration is not yet implemented.'));
                            return;
                        } else {
                            migration.add.forEach(function (x) {
                                //search for columns
                                expressions.push(util.format('ALTER TABLE "%s" ADD COLUMN "%s" %s', migration.appliesTo, x.name, SqliteAdapter.formatType(x)));
                            });
                        }
                    }
                    if (expressions.length > 0) {
                        async.eachSeries(expressions, function (expr, cb) {
                            self.execute(expr, [], function (err) {
                                cb(err);
                            });
                        }, function (err) {
                            if (err) {
                                cb(err);return;
                            }
                            cb(null, 1);
                        });
                    } else {
                        cb(null, 2);
                    }
                } else {
                    cb(new Error('Invalid table status.'));
                }
            },
            //Apply data model indexes
            function (arg, cb) {
                if (arg <= 0) {
                    return cb(null, arg);
                }
                if (migration.indexes) {
                    var tableIndexes = self.indexes(migration.appliesTo);
                    //enumerate migration constraints
                    async.eachSeries(migration.indexes, function (index, indexCallback) {
                        tableIndexes.create(index.name, index.columns, indexCallback);
                    }, function (err) {
                        //throw error
                        if (err) {
                            return cb(err);
                        }
                        //or return success flag
                        return cb(null, 1);
                    });
                } else {
                    //do nothing and exit
                    return cb(null, 1);
                }
            }, function (arg, cb) {
                if (arg > 0) {
                    //log migration to database
                    self.execute('INSERT INTO migrations("appliesTo", "model", "version", "description") VALUES (?,?,?,?)', [migration.appliesTo, migration.model, migration.version, migration.description], function (err) {
                        if (err) {
                            return cb(err);
                        }
                        cb(null, 1);
                    });
                } else {
                    migration.updated = true;
                    cb(null, arg);
                }
            }], function (err) {
                callback(err);
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
                                callback.call(self, err);return;
                            }
                            var value = 1;
                            if (result.length > 0) {
                                value = (parseInt(result[0][attribute]) || 0) + 1;
                            }
                            self.execute('INSERT INTO increment_id(entity, attribute, value) VALUES (?,?,?)', [entity, attribute, value], function (err) {
                                //throw error if any
                                if (err) {
                                    callback.call(self, err);return;
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
                                callback.call(self, err);return;
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
         * @param {*} batch
         * @param {function(Error=)} callback
         */

    }, {
        key: 'executeBatch',
        value: function executeBatch(batch, callback) {
            callback = callback || function () {};
            callback(new Error('DataAdapter.executeBatch() is obsolete. Use DataAdapter.executeInTransaction() instead.'));
        }
    }, {
        key: 'table',
        value: function table(name) {
            var self = this;
            return {
                /**
                 * @param {function(Error,Boolean=)} callback
                 */
                exists: function exists(callback) {
                    self.execute('SELECT COUNT(*) count FROM sqlite_master WHERE name=? AND type=\'table\';', [name], function (err, result) {
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
                    self.execute('SELECT MAX(version) AS version FROM migrations WHERE appliesTo=?', [name], function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        if (result.length === 0) callback(null, '0.0');else callback(null, result[0].version || '0.0');
                    });
                },
                /**
                 * @param {function(Error,Boolean=)} callback
                 */
                has_sequence: function has_sequence(callback) {
                    callback = callback || function () {};
                    self.execute('SELECT COUNT(*) count FROM sqlite_sequence WHERE name=?', [name], function (err, result) {
                        if (err) {
                            callback(err);return;
                        }
                        callback(null, result[0].count > 0);
                    });
                },
                /**
                 * @param {function(Error=,Array=)} callback
                 */
                columns: function columns(callback) {
                    callback = callback || function () {};
                    self.execute('PRAGMA table_info(?)', [name], function (err, result) {
                        if (err) {
                            callback(err);return;
                        }
                        var arr = [];
                        /**
                         * enumerates table columns
                         * @param {{name:string},{cid:number},{type:string},{notnull:number},{pk:number}} x
                         */
                        var iterator = function iterator(x) {
                            var col = { name: x.name, ordinal: x.cid, type: x.type, nullable: x.notnull ? true : false, primary: x.pk === 1 };
                            var matches = /(\w+)\((\d+),(\d+)\)/.exec(x.type);
                            if (matches) {
                                //extract max length attribute (e.g. integer(2,0) etc)
                                if (parseInt(matches[2]) > 0) {
                                    col.size = parseInt(matches[2]);
                                }
                                //extract scale attribute from field (e.g. integer(2,0) etc)
                                if (parseInt(matches[3]) > 0) {
                                    col.scale = parseInt(matches[3]);
                                }
                            }
                            arr.push(col);
                        };
                        result.forEach(iterator);
                        callback(null, arr);
                    });
                }
            };
        }
    }, {
        key: 'view',
        value: function view(name) {
            var self = this;
            return {
                /**
                 * @param {function(Error,Boolean=)} callback
                 */
                exists: function exists(callback) {
                    self.execute('SELECT COUNT(*) count FROM sqlite_master WHERE name=? AND type=\'view\';', [name], function (err, result) {
                        if (err) {
                            callback(err);return;
                        }
                        callback(null, result[0].count > 0);
                    });
                },
                /**
                 * @param {function(Error=)} callback
                 */
                drop: function drop(callback) {
                    callback = callback || function () {};
                    self.open(function (err) {
                        if (err) {
                            callback(err);return;
                        }
                        var sql = util.format("DROP VIEW IF EXISTS `%s`", name);
                        self.execute(sql, undefined, function (err) {
                            if (err) {
                                callback(err);return;
                            }
                            callback();
                        });
                    });
                },
                /**
                 * @param {QueryExpression|*} q
                 * @param {function(Error=)} callback
                 */
                create: function create(q, callback) {
                    var thisArg = this;
                    self.executeInTransaction(function (tr) {
                        thisArg.drop(function (err) {
                            if (err) {
                                tr(err);return;
                            }
                            try {
                                var sql = util.format("CREATE VIEW `%s` AS ", name);
                                var formatter = new SqliteFormatter();
                                sql += formatter.format(q);
                                self.execute(sql, undefined, tr);
                            } catch (e) {
                                tr(e);
                            }
                        });
                    }, function (err) {
                        callback(err);
                    });
                }
            };
        }

        /**
         * Executes a query against the underlying database
         * @param query {QueryExpression|string|*}
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
                    var formatter = new SqliteFormatter();
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
                        if (process.env.NODE_ENV === 'development') TraceUtils.log(util.format('SQL:%s, Parameters:%s', sql, JSON.stringify(values)));

                        //prepare statement - the traditional way
                        var prepared = self.prepare(sql, values);

                        var fn = void 0;
                        //validate statement
                        if (/^(SELECT|PRAGMA)/ig.test(prepared)) {
                            //prepare for select
                            fn = self.rawConnection.all;
                        } else {
                            //otherwise prepare for run
                            fn = self.rawConnection.run;
                        }
                        //execute raw command
                        fn.call(self.rawConnection, prepared, [], function (err, result) {
                            if (err) {
                                //log sql
                                TraceUtils.log(util.format('SQL Error:%s', prepared));
                                callback(err);
                            } else {
                                if (result) {
                                    if ((typeof result === 'undefined' ? 'undefined' : _typeof(result)) === 'object') {
                                        var keys = void 0;
                                        if (Array.isArray(result)) {
                                            if (result.length > 0) {
                                                keys = Object.keys(result[0]);
                                                result.forEach(function (x) {
                                                    keys.forEach(function (y) {
                                                        if (x[y] === null) {
                                                            delete x[y];
                                                        }
                                                    });
                                                });
                                            }
                                        } else {
                                            keys = Object.keys(result);
                                            keys.forEach(function (y) {
                                                if (result[y] === null) {
                                                    delete result[y];
                                                }
                                            });
                                        }
                                    }
                                    return callback(null, result);
                                } else {
                                    return callback();
                                }
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
                    self.execute('SELECT last_insert_rowid() as lastval', [], function (err, lastval) {
                        if (err) {
                            callback(null, { insertId: null });
                        } else {
                            lastval = lastval || [];
                            if (lastval.length > 0) callback(null, { insertId: lastval[0].lastval });else callback(null, { insertId: null });
                        }
                    });
                }
            });
        }
    }, {
        key: 'indexes',
        value: function indexes(table) {
            var self = this,
                formatter = new SqliteFormatter();
            return {
                list: function list(callback) {
                    var this1 = this;
                    if (this1.hasOwnProperty('indexes_')) {
                        return callback(null, this1['indexes_']);
                    }
                    self.execute(util.format('PRAGMA INDEX_LIST(`%s`)', table), null, function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        var indexes = result.filter(function (x) {
                            return x.origin === 'c';
                        }).map(function (x) {
                            return {
                                name: x.name,
                                columns: []
                            };
                        });
                        async.eachSeries(indexes, function (index, cb) {
                            self.execute(util.format('PRAGMA INDEX_INFO(`%s`)', index.name), null, function (err, columns) {
                                if (err) {
                                    return cb(err);
                                }
                                index.columns = _.map(columns, function (x) {
                                    return x.name;
                                });
                                return cb();
                            });
                        }, function (err) {
                            if (err) {
                                return callback(err);
                            }
                            this1['indexes_'] = indexes;
                            return callback(null, indexes);
                        });
                    });
                },
                /**
                 * @param {string} name
                 * @param {Array|string} columns
                 * @param {Function} callback
                 */
                create: function create(name, columns, callback) {
                    var cols = [];
                    if (typeof columns === 'string') {
                        cols.push(columns);
                    } else if (Array.isArray(columns)) {
                        cols.push.apply(cols, columns);
                    } else {
                        return callback(new Error("Invalid parameter. Columns parameter must be a string or an array of strings."));
                    }

                    var thisArg = this;
                    thisArg.list(function (err, indexes) {
                        if (err) {
                            return callback(err);
                        }
                        var ix = indexes.find(function (x) {
                            return x.name === name;
                        });
                        //format create index SQL statement
                        var sqlCreateIndex = util.format("CREATE INDEX %s ON %s(%s)", formatter.escapeName(name), formatter.escapeName(table), cols.map(function (x) {
                            return formatter.escapeName(x);
                        }).join(","));
                        if (typeof ix === 'undefined' || ix === null) {
                            self.execute(sqlCreateIndex, [], callback);
                        } else {
                            var nCols = cols.length;
                            //enumerate existing columns
                            ix.columns.forEach(function (x) {
                                if (cols.indexOf(x) >= 0) {
                                    //column exists in index
                                    nCols -= 1;
                                }
                            });
                            if (nCols > 0) {
                                //drop index
                                thisArg.drop(name, function (err) {
                                    if (err) {
                                        return callback(err);
                                    }
                                    //and create it
                                    self.execute(sqlCreateIndex, [], callback);
                                });
                            } else {
                                //do nothing
                                return callback();
                            }
                        }
                    });
                },
                drop: function drop(name, callback) {
                    if (typeof name !== 'string') {
                        return callback(new Error("Name must be a valid string."));
                    }
                    self.execute(util.format('PRAGMA INDEX_LIST(`%s`)', table), null, function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        var exists = typeof result.find(function (x) {
                            return x.name === name;
                        }) !== 'undefined';
                        if (!exists) {
                            return callback();
                        }
                        self.execute(util.format("DROP INDEX %s", self.escapeName(name)), [], callback);
                    });
                }
            };
        }
    }], [{
        key: 'formatType',
        value: function formatType(field) {
            var size = parseInt(field.size);
            var s = void 0;
            switch (field.type) {
                case 'Boolean':
                    s = 'INTEGER(1,0)';
                    break;
                case 'Byte':
                    s = 'INTEGER(1,0)';
                    break;
                case 'Number':
                case 'Float':
                    s = 'REAL';
                    break;
                case 'Counter':
                    return 'INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL';
                case 'Currency':
                    s = 'NUMERIC(' + (field.size || 19) + ',4)';
                    break;
                case 'Decimal':
                    s = 'NUMERIC';
                    if (field.size && field.scale) {
                        s += '(' + field.size + ',' + field.scale + ')';
                    }
                    break;
                case 'Date':
                case 'DateTime':
                    s = 'NUMERIC';
                    break;
                case 'Time':
                    s = size > 0 ? util.format('TEXT(%s,0)', size) : 'TEXT';
                    break;
                case 'Long':
                    s = 'NUMERIC';
                    break;
                case 'Duration':
                    s = size > 0 ? util.format('TEXT(%s,0)', size) : 'TEXT(48,0)';
                    break;
                case 'Integer':
                    s = 'INTEGER' + (field.size ? '(' + field.size + ',0)' : '');
                    break;
                case 'URL':
                case 'Text':
                case 'Note':
                    s = field.size ? util.format('TEXT(%s,0)', field.size) : 'TEXT';
                    break;
                case 'Image':
                case 'Binary':
                    s = 'BLOB';
                    break;
                case 'Guid':
                    s = 'TEXT(36,0)';
                    break;
                case 'Short':
                    s = 'INTEGER(2,0)';
                    break;
                default:
                    s = 'INTEGER';
                    break;
            }
            if (field.primary) {
                return s.concat(' PRIMARY KEY NOT NULL');
            } else {
                return s.concat(field.nullable === undefined ? ' NULL' : field.nullable ? ' NULL' : ' NOT NULL');
            }
        }
    }]);

    return SqliteAdapter;
}();

function zeroPad(number, length) {
    number = number || 0;
    var res = number.toString();
    while (res.length < length) {
        res = '0' + res;
    }
    return res;
}

/**
 * @augments {SqlFormatter}
 */

var SqliteFormatter = exports.SqliteFormatter = function (_SqlFormatter) {
    _inherits(SqliteFormatter, _SqlFormatter);

    /**
     * @constructor
     */
    function SqliteFormatter() {
        _classCallCheck(this, SqliteFormatter);

        var _this = _possibleConstructorReturn(this, (SqliteFormatter.__proto__ || Object.getPrototypeOf(SqliteFormatter)).call(this));

        _this.settings = {
            nameFormat: SqliteFormatter.NAME_FORMAT,
            forceAlias: true
        };
        return _this;
    }

    _createClass(SqliteFormatter, [{
        key: 'escapeName',
        value: function escapeName(name) {
            if (typeof name === 'string') return name.replace(/(\w+)/ig, this.settings.nameFormat);
            return name;
        }

        /**
         * Escapes an object or a value and returns the equivalent sql value.
         * @param {*} value - A value that is going to be escaped for SQL statements
         * @param {boolean=} unquoted - An optional value that indicates whether the resulted string will be quoted or not.
         * returns {string} - The equivalent SQL string value
         */

    }, {
        key: 'escape',
        value: function escape(value, unquoted) {
            if (typeof value === 'boolean') {
                return value ? '1' : '0';
            }
            if (value instanceof Date) {
                return this.escapeDate(value);
            }
            var res = _get(SqliteFormatter.prototype.__proto__ || Object.getPrototypeOf(SqliteFormatter.prototype), 'escape', this).bind(this)(value, unquoted);
            if (typeof value === 'string') {
                if (REGEXP_SINGLE_QUOTE.test(res))
                    //escape single quote (that is already escaped)
                    res = res.replace(/\\'/g, SINGLE_QUOTE_ESCAPE);
                if (REGEXP_DOUBLE_QUOTE.test(res))
                    //escape double quote (that is already escaped)
                    res = res.replace(/\\"/g, DOUBLE_QUOTE_ESCAPE);
                if (REGEXP_SLASH.test(res))
                    //escape slash (that is already escaped)
                    res = res.replace(/\\\\/g, SLASH_ESCAPE);
            }
            return res;
        }

        /**
         * @param {Date|*} val
         * @returns {string}
         */

    }, {
        key: 'escapeDate',
        value: function escapeDate(val) {
            var year = val.getFullYear();
            var month = zeroPad(val.getMonth() + 1, 2);
            var day = zeroPad(val.getDate(), 2);
            var hour = zeroPad(val.getHours(), 2);
            var minute = zeroPad(val.getMinutes(), 2);
            var second = zeroPad(val.getSeconds(), 2);
            var millisecond = zeroPad(val.getMilliseconds(), 3);
            //format timezone
            var offset = val.getTimezoneOffset(),
                timezone = (offset <= 0 ? '+' : '-') + zeroPad(-Math.floor(offset / 60), 2) + ':' + zeroPad(offset % 60, 2);
            return "'" + year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second + "." + millisecond + timezone + "'";
        }

        /**
         * Implements indexOf(str,substr) expression formatter.
         * @param {string} p0 The source string
         * @param {string} p1 The string to search for
         * @returns {string}
         */

    }, {
        key: '$indexof',
        value: function $indexof(p0, p1) {
            return util.format('(INSTR(%s,%s)-1)', this.escape(p0), this.escape(p1));
        }

        /**
         * Implements indexOf(str,substr) expression formatter.
         * @param {string} p0 The source string
         * @param {string} p1 The string to search for
         * @returns {string}
         */

    }, {
        key: '$indexOf',
        value: function $indexOf(p0, p1) {
            return util.format('(INSTR(%s,%s)-1)', this.escape(p0), this.escape(p1));
        }

        /**
         * Implements contains(a,b) expression formatter.
         * @param {*} p0 The source string
         * @param {*} p1 The string to search for
         * @returns {string}
         */

    }, {
        key: '$text',
        value: function $text(p0, p1) {
            return util.format('(INSTR(%s,%s)-1)>=0', this.escape(p0), this.escape(p1));
        }

        /**
         * Implements simple regular expression formatter. Important Note: SQLite 3 does not provide a core sql function for regular expression matching.
         * @param {*} p0 The source string or field
         * @param {*} p1 The string to search for
         */

    }, {
        key: '$regex',
        value: function $regex(p0, p1) {
            //escape expression
            var s1 = this.escape(p1, true);
            //implement starts with equivalent for LIKE T-SQL
            if (/^\^/.test(s1)) {
                s1 = s1.replace(/^\^/, '');
            } else {
                s1 = '%' + s1;
            }
            //implement ends with equivalent for LIKE T-SQL
            if (/\$$/.test(s1)) {
                s1 = s1.replace(/\$$/, '');
            } else {
                s1 += '%';
            }
            return util.format('LIKE(\'%s\',%s) >= 1', s1, this.escape(p0));
        }

        /**
         * Implements concat(a,b) expression formatter.
         * @param {*} p0
         * @param {*} p1
         * @returns {string}
         */

    }, {
        key: '$concat',
        value: function $concat(p0, p1) {
            return util.format('(IFNULL(%s,\'\') || IFNULL(%s,\'\'))', this.escape(p0), this.escape(p1));
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
            if (length) return util.format('SUBSTR(%s,%s,%s)', this.escape(p0), pos.valueOf() + 1, length.valueOf());else return util.format('SUBSTR(%s,%s)', this.escape(p0), pos.valueOf() + 1);
        }

        /**
         * Implements substring(str,pos) expression formatter.
         * @param {String} p0 The source string
         * @param {Number} pos The starting position
         * @param {Number=} length The length of the resulted string
         * @returns {string}
         */

    }, {
        key: '$substr',
        value: function $substr(p0, pos, length) {
            if (length) return util.format('SUBSTR(%s,%s,%s)', this.escape(p0), pos.valueOf() + 1, length.valueOf());else return util.format('SUBSTR(%s,%s)', this.escape(p0), pos.valueOf() + 1);
        }

        /**
         * Implements length(a) expression formatter.
         * @param {*} p0
         * @returns {string}
         */

    }, {
        key: '$length',
        value: function $length(p0) {
            return util.format('LENGTH(%s)', this.escape(p0));
        }
    }, {
        key: '$ceiling',
        value: function $ceiling(p0) {
            return util.format('CEIL(%s)', this.escape(p0));
        }
    }, {
        key: '$startswith',
        value: function $startswith(p0, p1) {
            //validate params
            if (_.isNil(p0) || _.isNil(p1)) return '';
            return 'LIKE(\'' + this.escape(p1, true) + '%\',' + this.escape(p0) + ')';
        }
    }, {
        key: '$contains',
        value: function $contains(p0, p1) {
            //validate params
            if (_.isNil(p0) || _.isNil(p1)) return '';
            return 'LIKE(\'%' + this.escape(p1, true) + '%\',' + this.escape(p0) + ')';
        }
    }, {
        key: '$endswith',
        value: function $endswith(p0, p1) {
            //validate params
            if (_.isNil(p0) || _.isNil(p1)) return '';
            return 'LIKE(\'%' + this.escape(p1, true) + '\',' + this.escape(p0) + ')';
        }
    }, {
        key: '$day',
        value: function $day(p0) {
            return 'CAST(strftime(\'%d\', ' + this.escape(p0) + ') AS INTEGER)';
        }
    }, {
        key: '$dayOfMonth',
        value: function $dayOfMonth(p0) {
            return 'CAST(strftime(\'%d\', ' + this.escape(p0) + ') AS INTEGER)';
        }
    }, {
        key: '$month',
        value: function $month(p0) {
            return 'CAST(strftime(\'%m\', ' + this.escape(p0) + ') AS INTEGER)';
        }
    }, {
        key: '$year',
        value: function $year(p0) {
            return 'CAST(strftime(\'%Y\', ' + this.escape(p0) + ') AS INTEGER)';
        }
    }, {
        key: '$hour',
        value: function $hour(p0) {
            return 'CAST(strftime(\'%H\', ' + this.escape(p0) + ') AS INTEGER)';
        }
    }, {
        key: '$minute',
        value: function $minute(p0) {
            return 'CAST(strftime(\'%M\', ' + this.escape(p0) + ') AS INTEGER)';
        }
    }, {
        key: '$second',
        value: function $second(p0) {
            return 'CAST(strftime(\'%S\', ' + this.escape(p0) + ') AS INTEGER)';
        }
    }, {
        key: '$date',
        value: function $date(p0) {
            return 'date(' + this.escape(p0) + ')';
        }
    }]);

    return SqliteFormatter;
}(SqlFormatter);

SqliteFormatter.NAME_FORMAT = '`$1`';

var REGEXP_SINGLE_QUOTE = /\\'/g,
    SINGLE_QUOTE_ESCAPE = '\'\'',
    REGEXP_DOUBLE_QUOTE = /\\"/g,
    DOUBLE_QUOTE_ESCAPE = '"',
    REGEXP_SLASH = /\\\\/g,
    SLASH_ESCAPE = '\\';

/**
 * Creates an instance of SqliteAdapter object that represents a SQLite database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {*}
 */
function createInstance(options) {
    return new SqliteAdapter(options);
}
//# sourceMappingURL=index.js.map
