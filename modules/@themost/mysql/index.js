'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.MySqlFormatter = exports.MySqlAdapter = undefined;

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

var _mysql = require('mysql');

var mysql = _interopRequireDefault(_mysql).default;

var _async = require('async');

var async = _interopRequireDefault(_async).default;

var _util = require('util');

var util = _interopRequireDefault(_util).default;

var _lodash = require('lodash');

var _ = _lodash._;

var _formatter = require('@themost/query/formatter');

var SqlFormatter = _formatter.SqlFormatter;

var _query = require('@themost/query/query');

var QueryExpression = _query.QueryExpression;
var QueryField = _query.QueryField;

var _utils = require('themost/common/utils');

var TraceUtils = _utils.TraceUtils;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class
 * @constructor
 * @augments DataAdapter
 */
var MySqlAdapter = function () {
    function MySqlAdapter(options) {
        _classCallCheck(this, MySqlAdapter);

        /**
         * @private
         * @type {Connection}
         */
        this.rawConnection = null;
        /**
         * Gets or sets database connection string
         * @type {*}
         */
        this.options = options;
        /**
         * Gets or sets a boolean that indicates whether connection pooling is enabled or not.
         * @type {boolean}
         */
        this.connectionPooling = false;
    }

    /**
     * Opens database connection
     */


    _createClass(MySqlAdapter, [{
        key: 'open',
        value: function open(callback) {
            callback = callback || function () {};
            var self = this;
            if (this.rawConnection) {
                return callback();
            }
            //get current timezone
            var offset = new Date().getTimezoneOffset(),
                timezone = (offset <= 0 ? '+' : '-') + zeroPad(-Math.floor(offset / 60), 2) + ':' + zeroPad(offset % 60, 2);
            if (self.connectionPooling) {
                if (typeof MySqlAdapter.pool === 'undefined') {
                    MySqlAdapter.pool = mysql.createPool(this.options);
                }
                MySqlAdapter.pool.getConnection(function (err, connection) {
                    if (err) {
                        return callback(err);
                    } else {
                        self.rawConnection = connection;
                        self.execute("SET time_zone=?", timezone, function (err) {
                            return callback(err);
                        });
                    }
                });
            } else {
                self.rawConnection = mysql.createConnection(this.options);
                self.rawConnection.connect(function (err) {
                    if (err) {
                        return callback(err);
                    } else {
                        //set connection timezone
                        self.execute("SET time_zone=?", timezone, function (err) {
                            return callback(err);
                        });
                    }
                });
            }
        }

        /**
         * @param {Function} callback
         */

    }, {
        key: 'close',
        value: function close(callback) {
            var self = this;
            callback = callback || function () {};
            if (!self.rawConnection) return;
            if (self.connectionPooling) {
                self.rawConnection.release();
                self.rawConnection = null;
            } else {
                self.rawConnection.end(function (err) {
                    if (err) {
                        TraceUtils.log(err);
                        //do nothing
                        self.rawConnection = null;
                    }
                    callback();
                });
            }
        }

        /**
         * Begins a data transaction and executes the given function
         * @param {Function} fn
         * @param {Function} callback
         */

    }, {
        key: 'executeInTransaction',
        value: function executeInTransaction(fn, callback) {
            var self = this;
            //ensure callback
            callback = callback || function () {};
            //ensure that database connection is open
            self.open(function (err) {
                if (err) {
                    return callback.bind(self)(err);
                }
                //execution is already in transaction
                if (self.__transaction) {
                    //so invoke method
                    fn.bind(self)(function (err) {
                        //call callback
                        callback.bind(self)(err);
                    });
                } else {
                    self.execute('START TRANSACTION', null, function (err) {
                        if (err) {
                            callback.bind(self)(err);
                        } else {
                            //set transaction flag to true
                            self.__transaction = true;
                            try {
                                //invoke method
                                fn.bind(self)(function (error) {
                                    if (error) {
                                        //rollback transaction
                                        self.execute('ROLLBACK', null, function () {
                                            //st flag to false
                                            self.__transaction = false;
                                            //call callback
                                            callback.bind(self)(error);
                                        });
                                    } else {
                                        //commit transaction
                                        self.execute('COMMIT', null, function (err) {
                                            //set flag to false
                                            self.__transaction = false;
                                            //call callback
                                            callback.bind(self)(err);
                                        });
                                    }
                                });
                            } catch (err) {
                                //rollback transaction
                                self.execute('ROLLBACK', null, function (err) {
                                    //set flag to false
                                    self.__transaction = false;
                                    //call callback
                                    callback.bind(self)(err);
                                });
                            }
                        }
                    });
                }
            });
        }

        /**
         * Executes an operation against database and returns the results.
         * @param {DataModelBatch} batch
         * @param {Function} callback
         */

    }, {
        key: 'executeBatch',
        value: function executeBatch(batch, callback) {
            callback = callback || function () {};
            callback(new Error('DataAdapter.executeBatch() is obsolete. Use DataAdapter.executeInTransaction() instead.'));
        }

        /**
         * Produces a new identity value for the given entity and attribute.
         * @param {string} entity The target entity name
         * @param {string} attribute The target attribute
         * @param {Function=} callback
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
                    callback.bind(self)(err);return;
                }

                self.execute('SELECT * FROM increment_id WHERE entity=? AND attribute=?', [entity, attribute], function (err, result) {
                    if (err) {
                        callback.bind(self)(err);return;
                    }
                    if (result.length === 0) {
                        //get max value by querying the given entity
                        var q = QueryExpression.create(entity).select(QueryField.create().max(attribute));
                        self.execute(q, null, function (err, result) {
                            if (err) {
                                callback.bind(self)(err);return;
                            }
                            var value = 1;
                            if (result.length > 0) {
                                value = parseInt(result[0][attribute]) + 1;
                            }
                            self.execute('INSERT INTO increment_id(entity, attribute, value) VALUES (?,?,?)', [entity, attribute, value], function (err) {
                                //throw error if any
                                if (err) {
                                    callback.bind(self)(err);return;
                                }
                                //return new increment value
                                callback.bind(self)(err, value);
                            });
                        });
                    } else {
                        //get new increment value
                        var value = parseInt(result[0].value) + 1;
                        self.execute('UPDATE increment_id SET value=? WHERE id=?', [value, result[0].id], function (err) {
                            //throw error if any
                            if (err) {
                                callback.bind(self)(err);return;
                            }
                            //return new increment value
                            callback.bind(self)(err, value);
                        });
                    }
                });
            });
        }

        /**
         * @param query {*}
         * @param values {*}
         * @param {function} callback
         */

    }, {
        key: 'execute',
        value: function execute(query, values, callback) {
            var self = this;
            var sql = null;
            try {

                if (typeof query === 'string') {
                    sql = query;
                } else {
                    //format query expression or any object that may be act as query expression
                    var formatter = new MySqlFormatter();
                    formatter.settings.nameFormat = MySqlAdapter.NAME_FORMAT;
                    sql = formatter.format(query);
                }
                //validate sql statement
                if (typeof sql !== 'string') {
                    callback.bind(self)(new Error('The executing command is of the wrong type or empty.'));
                    return;
                }
                //ensure connection
                self.open(function (err) {
                    if (err) {
                        callback.bind(self)(err);
                    } else {
                        var startTime = void 0;
                        if (process.env.NODE_ENV === 'development') {
                            startTime = new Date().getTime();
                        }
                        //execute raw command
                        self.rawConnection.query(sql, values, function (err, result) {
                            if (process.env.NODE_ENV === 'development') {
                                TraceUtils.log(util.format('SQL (Execution Time:%sms):%s, Parameters:%s', new Date().getTime() - startTime, sql, JSON.stringify(values)));
                            }
                            callback.bind(self)(err, result);
                        });
                    }
                });
            } catch (err) {
                callback.bind(self)(err);
            }
        }

        /**
         * Formats an object based on the format string provided. Valid formats are:
         * %t : Formats a field and returns field type definition
         * %f : Formats a field and returns field name
         * @param  {string} format
         * @param {*} obj
         */

    }, {
        key: 'createView',


        /**
         * @param {string} name
         * @param {QueryExpression} query
         * @param {Function} callback
         */
        value: function createView(name, query, callback) {
            this.view(name).create(query, callback);
        }

        /**
         *
         * @param  {DataModelMigration|*} obj - An Object that represents the data model scheme we want to migrate
         * @param {Function} callback
         */

    }, {
        key: 'migrate',
        value: function migrate(obj, callback) {
            if (obj === null) return;
            var self = this;
            var migration = obj;
            if (migration.appliesTo === null) throw new Error("Model name is undefined");
            self.open(function (err) {
                if (err) {
                    callback.bind(self)(err);
                } else {
                    async.waterfall([
                    //1. Check migrations table existence
                    function (cb) {
                        self.table('migrations').exists(function (err, exists) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, exists);
                        });
                    },
                    //2. Create migrations table if not exists
                    function (arg, cb) {
                        if (arg > 0) {
                            return cb(null, 0);
                        }
                        self.table('migrations').create([{ name: 'id', type: 'Counter', primary: true, nullable: false }, { name: 'appliesTo', type: 'Text', size: '80', nullable: false }, { name: 'model', type: 'Text', size: '120', nullable: true }, { name: 'description', type: 'Text', size: '512', nullable: true }, { name: 'version', type: 'Text', size: '40', nullable: false }], function (err) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, 0);
                        });
                    },
                    //3. Check if migration has already been applied
                    function (arg, cb) {
                        self.execute('SELECT COUNT(*) AS `count` FROM `migrations` WHERE `appliesTo`=? and `version`=?', [migration.appliesTo, migration.version], function (err, result) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, result[0].count);
                        });
                    },
                    //4a. Check table existence
                    function (arg, cb) {
                        //migration has already been applied (set migration.updated=true)
                        if (arg > 0) {
                            obj.updated = true;return cb(null, -1);
                        }
                        self.table(migration.appliesTo).exists(function (err, exists) {
                            if (err) {
                                return cb(err);
                            }
                            cb(null, exists);
                        });
                    },
                    //4b. Migrate target table (create or alter)
                    function (arg, cb) {
                        //migration has already been applied
                        if (arg < 0) {
                            return cb(null, arg);
                        }
                        if (arg === 0) {
                            //create table
                            return self.table(migration.appliesTo).create(migration.add, function (err) {
                                if (err) {
                                    return cb(err);
                                }
                                cb(null, 1);
                            });
                        }
                        //columns to be removed (unsupported)
                        if (_.isArray(migration.remove)) {
                            if (migration.remove.length > 0) {
                                return cb(new Error('Data migration remove operation is not supported by this adapter.'));
                            }
                        }
                        //columns to be changed (unsupported)
                        if (_.isArray(migration.change)) {
                            if (migration.change.length > 0) {
                                return cb(new Error('Data migration change operation is not supported by this adapter. Use add collection instead.'));
                            }
                        }
                        var column = void 0,
                            newType = void 0,
                            oldType = void 0;
                        if (_.isArray(migration.add)) {
                            //init change collection
                            migration.change = [];
                            //get table columns
                            self.table(migration.appliesTo).columns(function (err, columns) {
                                if (err) {
                                    return cb(err);
                                }

                                var _loop = function _loop(_i) {
                                    var x = migration.add[_i];
                                    column = _.find(columns, function (y) {
                                        return y.name === x.name;
                                    });
                                    if (column) {
                                        //if column is primary key remove it from collection
                                        if (column.primary) {
                                            migration.add.splice(_i, 1);
                                            _i -= 1;
                                        } else {
                                            //get new type
                                            newType = MySqlAdapter.format('%t', x);
                                            //get old type
                                            oldType = column.type1.replace(/\s+$/, '') + (column.nullable === true || column.nullable === 1 ? ' null' : ' not null');
                                            //remove column from collection
                                            migration.add.splice(_i, 1);
                                            _i -= 1;
                                            if (newType !== oldType) {
                                                //add column to alter collection
                                                migration.change.push(x);
                                            }
                                        }
                                    }
                                    i = _i;
                                };

                                for (var i = 0; i < migration.add.length; i++) {
                                    _loop(i);
                                }
                                //alter table
                                var targetTable = self.table(migration.appliesTo);
                                //add new columns (if any)
                                targetTable.add(migration.add, function (err) {
                                    if (err) {
                                        return cb(err);
                                    }
                                    //modify columns (if any)
                                    targetTable.change(migration.change, function (err) {
                                        if (err) {
                                            return cb(err);
                                        }
                                        cb(null, 1);
                                    });
                                });
                            });
                        } else {
                            cb(new Error('Invalid migration data.'));
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
                            self.execute('INSERT INTO `migrations` (`appliesTo`,`model`,`version`,`description`) VALUES (?,?,?,?)', [migration.appliesTo, migration.model, migration.version, migration.description], function (err) {
                                if (err) {
                                    return cb(err);
                                }
                                return cb(null, 1);
                            });
                        } else cb(null, arg);
                    }], function (err, result) {
                        callback(err, result);
                    });
                }
            });
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
                    callback = callback || function () {};
                    self.execute('SELECT COUNT(*) AS `count` FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_SCHEMA=DATABASE()', [name], function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        callback(null, result[0].count);
                    });
                },
                /**
                 * @param {function(Error,string=)} callback
                 */
                version: function version(callback) {
                    callback = callback || function () {};
                    self.execute('SELECT MAX(`version`) AS `version` FROM `migrations` WHERE `appliesTo`=?', [name], function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        if (result.length === 0) callback(null, '0.0');else callback(null, result[0].version || '0.0');
                    });
                },
                /**
                 * @param {function(Error=,Array=)} callback
                 */
                columns: function columns(callback) {
                    callback = callback || function () {};
                    self.execute('SELECT COLUMN_NAME AS `name`, DATA_TYPE as `type`, ' + 'CHARACTER_MAXIMUM_LENGTH as `size`,CASE WHEN IS_NULLABLE=\'YES\' THEN 1 ELSE 0 END AS `nullable`, ' + 'NUMERIC_PRECISION as `precision`, NUMERIC_SCALE as `scale`, ' + 'CASE WHEN COLUMN_KEY=\'PRI\' THEN 1 ELSE 0 END AS `primary`, ' + 'CONCAT(COLUMN_TYPE, (CASE WHEN EXTRA = NULL THEN \'\' ELSE CONCAT(\' \',EXTRA) END)) AS `type1` ' + 'FROM information_schema.COLUMNS WHERE TABLE_NAME=? AND TABLE_SCHEMA=DATABASE()', [name], function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        callback(null, result);
                    });
                },
                /**
                 * @param {Array} fields
                 * @param {Function} callback
                 */
                create: function create(fields, callback) {
                    callback = callback || function () {};
                    fields = fields || [];
                    if (!_.isArray(fields)) {
                        return callback(new Error('Invalid argument type. Expected Array.'));
                    }
                    if (fields.length === 0) {
                        return callback(new Error('Invalid argument. Fields collection cannot be empty.'));
                    }
                    var strFields = _.map(_.filter(fields, function (x) {
                        return !x.oneToMany;
                    }), function (x) {
                        return MySqlAdapter.format('`%f` %t', x);
                    }).join(', ');
                    //add primary key constraint
                    var strPKFields = _.map(_.filter(fields, function (x) {
                        return x.primary === true || x.primary === 1;
                    }), function (x) {
                        return MySqlAdapter.format('`%f`', x);
                    }).join(', ');
                    if (strPKFields.length > 0) {
                        strFields += ', ' + util.format('PRIMARY KEY (%s)', strPKFields);
                    }
                    var sql = util.format('CREATE TABLE %s (%s)', name, strFields);
                    self.execute(sql, null, function (err) {
                        callback(err);
                    });
                },
                /**
                 * Alters the table by adding an array of fields
                 * @param {{name:string,type:string,primary:boolean|number,nullable:boolean|number,size:number,oneToMany:boolean}[]|*} fields
                 * @param callback
                 */
                add: function add(fields, callback) {
                    callback = callback || function () {};
                    callback = callback || function () {};
                    fields = fields || [];
                    if (!_.isArray(fields)) {
                        //invalid argument exception
                        return callback(new Error('Invalid argument type. Expected Array.'));
                    }
                    if (fields.length === 0) {
                        //do nothing
                        return callback();
                    }
                    var formatter = new MySqlFormatter();
                    var strTable = formatter.escapeName(name);
                    //generate SQL statement
                    var sql = _.map(fields, function (x) {
                        return MySqlAdapter.format('ALTER TABLE ' + strTable + ' ADD COLUMN `%f` %t', x);
                    }).join(';');
                    self.execute(sql, [], function (err) {
                        callback(err);
                    });
                },
                /**
                 * Alters the table by modifying an array of fields
                 * @param {{name:string,type:string,primary:boolean|number,nullable:boolean|number,size:number,oneToMany:boolean}[]|*} fields
                 * @param callback
                 */
                change: function change(fields, callback) {
                    callback = callback || function () {};
                    callback = callback || function () {};
                    fields = fields || [];
                    if (!_.isArray(fields)) {
                        //invalid argument exception
                        return callback(new Error('Invalid argument type. Expected Array.'));
                    }
                    if (fields.length === 0) {
                        //do nothing
                        return callback();
                    }
                    var formatter = new MySqlFormatter();
                    var strTable = formatter.escapeName(name);
                    //generate SQL statement
                    var sql = _.map(fields, function (x) {
                        return MySqlAdapter.format('ALTER TABLE ' + strTable + ' MODIFY COLUMN `%f` %t', x);
                    }).join(';');
                    self.execute(sql, [], function (err) {
                        callback(err);
                    });
                }
            };
        }
    }, {
        key: 'view',
        value: function view(name) {
            var self = this;
            var owner = void 0;
            var view = void 0;

            var matches = /(\w+)\.(\w+)/.exec(name);
            if (matches) {
                //get schema owner
                owner = matches[1];
                //get table name
                view = matches[2];
            } else {
                view = name;
            }
            return {
                /**
                 * @param {function(Error,Boolean=)} callback
                 */
                exists: function exists(callback) {
                    var sql = 'SELECT COUNT(*) AS `count` FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_TYPE=\'VIEW\' AND TABLE_SCHEMA=DATABASE()';
                    self.execute(sql, [name], function (err, result) {
                        if (err) {
                            callback(err);return;
                        }
                        callback(null, result[0].count > 0);
                    });
                },
                /**
                 * @param {Function} callback
                 */
                drop: function drop(callback) {
                    callback = callback || function () {};
                    self.open(function (err) {
                        if (err) {
                            return callback(err);
                        }
                        var sql = 'SELECT COUNT(*) AS `count` FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_TYPE=\'VIEW\' AND TABLE_SCHEMA=DATABASE()';
                        self.execute(sql, [name], function (err, result) {
                            if (err) {
                                return callback(err);
                            }
                            var exists = result[0].count > 0;
                            if (exists) {
                                var _sql = util.format('DROP VIEW `%s`', name);
                                self.execute(_sql, undefined, function (err) {
                                    if (err) {
                                        callback(err);return;
                                    }
                                    callback();
                                });
                            } else {
                                callback();
                            }
                        });
                    });
                },
                /**
                 * @param {QueryExpression|*} q
                 * @param {Function} callback
                 */
                create: function create(q, callback) {
                    var thisArg = this;
                    self.executeInTransaction(function (tr) {
                        thisArg.drop(function (err) {
                            if (err) {
                                tr(err);return;
                            }
                            try {
                                var sql = util.format('CREATE VIEW `%s` AS ', name);
                                var formatter = new MySqlFormatter();
                                sql += formatter.format(q);
                                self.execute(sql, [], tr);
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
    }, {
        key: 'indexes',
        value: function indexes(table) {
            var self = this,
                formatter = new MySqlFormatter();
            return {
                list: function list(callback) {
                    var this1 = this;
                    if (this1.hasOwnProperty('indexes_')) {
                        return callback(null, this1['indexes_']);
                    }
                    self.execute(util.format("SHOW INDEXES FROM `%s`", table), null, function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        var indexes = [];
                        _.forEach(result, function (x) {
                            var obj = _.find(indexes, function (y) {
                                return y.name === x['Key_name'];
                            });
                            if (typeof obj === 'undefined') {
                                indexes.push({
                                    name: x['Key_name'],
                                    columns: [x['Column_name']]
                                });
                            } else {
                                obj.columns.push(x['Column_name']);
                            }
                        });
                        return callback(null, indexes);
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
                    } else if (_.isArray(columns)) {
                        cols.push.apply(cols, columns);
                    } else {
                        return callback(new Error("Invalid parameter. Columns parameter must be a string or an array of strings."));
                    }
                    var thisArg = this;
                    thisArg.list(function (err, indexes) {

                        if (err) {
                            return callback(err);
                        }
                        var ix = _.find(indexes, function (x) {
                            return x.name === name;
                        });
                        //format create index SQL statement
                        var sqlCreateIndex = util.format("CREATE INDEX %s ON %s(%s)", formatter.escapeName(name), formatter.escapeName(table), _.map(cols, function (x) {
                            return formatter.escapeName(x);
                        }).join(","));
                        if (typeof ix === 'undefined' || ix === null) {
                            self.execute(sqlCreateIndex, [], callback);
                        } else {
                            var nCols = cols.length;
                            //enumerate existing columns
                            _.forEach(ix.columns, function (x) {
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
                    this.list(function (err, indexes) {
                        if (err) {
                            return callback(err);
                        }
                        var exists = typeof _.find(indexes, function (x) {
                            return x.name === name;
                        }) !== 'undefined';
                        if (!exists) {
                            return callback();
                        }
                        self.execute(util.format("DROP INDEX %s ON %s", formatter.escapeName(name), formatter.escapeName(table)), [], callback);
                    });
                }
            };
        }
    }, {
        key: 'queryFormat',
        value: function queryFormat(query, values) {
            if (!values) return query;
            var self = this;
            return query.replace(/:(\w+)/g, function (txt, key) {
                if (values.hasOwnProperty(key)) {
                    return self.escape(values[key]);
                }
                return txt;
            }.bind(this));
        }
    }], [{
        key: 'format',
        value: function format(_format, obj) {
            var result = _format;
            if (/%t/.test(_format)) result = result.replace(/%t/g, MySqlAdapter.formatType(obj));
            if (/%f/.test(_format)) result = result.replace(/%f/g, obj.name);
            return result;
        }
    }, {
        key: 'formatType',
        value: function formatType(field) {
            var size = parseInt(field.size);
            var scale = parseInt(field.scale);
            var s = 'varchar(512) NULL';
            var type = field.type;
            switch (type) {
                case 'Boolean':
                    s = 'tinyint(1)';
                    break;
                case 'Byte':
                    s = 'tinyint(3) unsigned';
                    break;
                case 'Number':
                case 'Float':
                    s = 'float';
                    break;
                case 'Counter':
                    return 'int(11) auto_increment not null';
                case 'Currency':
                    s = 'decimal(19,4)';
                    break;
                case 'Decimal':
                    s = util.format('decimal(%s,%s)', size > 0 ? size : 19, scale > 0 ? scale : 8);
                    break;
                case 'Date':
                    s = 'date';
                    break;
                case 'DateTime':
                case 'Time':
                    s = 'timestamp';
                    break;
                case 'Integer':
                case 'Duration':
                    s = 'int(11)';
                    break;
                case 'URL':
                case 'Text':
                    s = size > 0 ? 'varchar(' + size + ')' : 'varchar(512)';
                    break;
                case 'Note':
                    s = size > 0 ? 'varchar(' + size + ')' : 'text';
                    break;
                case 'Image':
                case 'Binary':
                    s = size > 0 ? 'blob(' + size + ')' : 'blob';
                    break;
                case 'Guid':
                    s = 'varchar(36)';
                    break;
                case 'Short':
                    s = 'smallint(6)';
                    break;
                default:
                    s = 'int(11)';
                    break;
            }
            if (field.primary === true) {
                s += ' not null';
            } else {
                s += typeof field.nullable === 'undefined' ? ' null' : field.nullable === true || field.nullable === 1 ? ' null' : ' not null';
            }
            return s;
        }
    }]);

    return MySqlAdapter;
}();

exports.MySqlAdapter = MySqlAdapter;


function zeroPad(number, length) {
    number = number || 0;
    var res = number.toString();
    while (res.length < length) {
        res = '0' + res;
    }
    return res;
}

/**
 * @class
 * @augments {SqlFormatter}
 */

var MySqlFormatter = exports.MySqlFormatter = function (_SqlFormatter) {
    _inherits(MySqlFormatter, _SqlFormatter);

    /**
     * @constructor
     */
    function MySqlFormatter() {
        _classCallCheck(this, MySqlFormatter);

        var _this = _possibleConstructorReturn(this, (MySqlFormatter.__proto__ || Object.getPrototypeOf(MySqlFormatter)).call(this));

        _this.settings = {
            nameFormat: MySqlFormatter.NAME_FORMAT,
            forceAlias: true
        };
        return _this;
    }

    _createClass(MySqlFormatter, [{
        key: 'escapeName',
        value: function escapeName(name) {
            if (typeof name === 'string') {
                if (/^(\w+)\.(\w+)$/g.test(name)) {
                    return name.replace(/(\w+)/g, MySqlFormatter.NAME_FORMAT);
                }
                return name.replace(/(\w+)$|^(\w+)$/g, MySqlFormatter.NAME_FORMAT);
            }
            return name;
        }
    }, {
        key: 'escape',
        value: function escape(value, unquoted) {

            if (typeof value === 'boolean') {
                return value ? '1' : '0';
            }
            if (value instanceof Date) {
                return this.escapeDate(value);
            }
            return _get(MySqlFormatter.prototype.__proto__ || Object.getPrototypeOf(MySqlFormatter.prototype), 'escape', this).bind(this)(value, unquoted);
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
            //var millisecond = zeroPad(val.getMilliseconds(), 3);
            //format timezone
            var offset = val.getTimezoneOffset(),
                timezone = (offset <= 0 ? '+' : '-') + zeroPad(-Math.floor(offset / 60), 2) + ':' + zeroPad(offset % 60, 2);
            var datetime = year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
            //convert timestamp to mysql server timezone (by using date object timezone offset)
            return util.format("CONVERT_TZ('%s','%s', @@session.time_zone)", datetime, timezone);
        }
    }]);

    return MySqlFormatter;
}(SqlFormatter);

MySqlFormatter.NAME_FORMAT = '`$1`';

/**
 * Creates an instance of MySqlAdapter object that represents a MySql database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {*}
 */
function createInstance(options) {
    return new MySqlAdapter(options);
}
//# sourceMappingURL=index.js.map
