/**
 * @license
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2014, Kyriakos Barbounakis k.barbounakis@gmail.com
 *                     Anthi Oikonomou anthioikonomou@gmail.com
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
import mysql from 'mysql';
import async from 'async';
import util from 'util';
import _ from 'lodash';
import {SqlFormatter} from '@themost/query/formatter';
import {QueryExpression,QueryField} from '@themost/query/query';
import {TraceUtils} from '@themost/common/utils';

/**
 * @class
 * @constructor
 * @augments DataAdapter
 */
export class MySqlAdapter {
    constructor(options) {
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
    open(callback) {
        callback = callback || function() {};
        const self = this;
        if (this.rawConnection) {
            return callback();
        }
        //get current timezone
        const offset = (new Date()).getTimezoneOffset(), timezone = (offset<=0 ? '+' : '-') + zeroPad(-Math.floor(offset/60),2) + ':' + zeroPad(offset%60,2);
        if (self.connectionPooling) {
            if (typeof MySqlAdapter.pool === 'undefined') {
                MySqlAdapter.pool = mysql.createPool(this.options);
            }
            MySqlAdapter.pool.getConnection(function(err, connection) {
                if (err) {
                    return callback(err);
                }
                else {
                    self.rawConnection = connection;
                    self.execute("SET time_zone=?", timezone, function(err) {
                        return callback(err);
                    });
                }
            });
        }
        else {
            self.rawConnection = mysql.createConnection(this.options);
            self.rawConnection.connect(function(err) {
                if (err) {
                    return callback(err);
                }
                else {
                    //set connection timezone
                    self.execute("SET time_zone=?", timezone, function(err) {
                        return callback(err);
                    });
                }
            });
        }
    }

    /**
     * @param {Function} callback
     */
    close(callback) {
        const self = this;
        callback = callback || function() {};
        if (!self.rawConnection)
            return;
        if (self.connectionPooling) {
            self.rawConnection.release();
            self.rawConnection=null;
        }
        else {
            self.rawConnection.end(function(err) {
                if (err) {
                    TraceUtils.log(err);
                    //do nothing
                    self.rawConnection=null;
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
    executeInTransaction(fn, callback) {
        const self = this;
        //ensure callback
        callback = callback || function () {};
        //ensure that database connection is open
        self.open(function(err) {
            if (err) {
                return callback.bind(self)(err);
            }
            //execution is already in transaction
            if (self.__transaction) {
                //so invoke method
                fn.bind(self)(function(err)
                {
                    //call callback
                    callback.bind(self)(err);
                });
            }
            else {
                self.execute('START TRANSACTION',null, function(err) {
                    if (err) {
                        callback.bind(self)(err);
                    }
                    else {
                        //set transaction flag to true
                        self.__transaction = true;
                        try {
                            //invoke method
                            fn.bind(self)(function(error)
                            {
                                if (error) {
                                    //rollback transaction
                                    self.execute('ROLLBACK', null, function() {
                                        //st flag to false
                                        self.__transaction = false;
                                        //call callback
                                        callback.bind(self)(error);
                                    });
                                }
                                else {
                                    //commit transaction
                                    self.execute('COMMIT', null, function(err) {
                                        //set flag to false
                                        self.__transaction = false;
                                        //call callback
                                        callback.bind(self)(err);
                                    });
                                }
                            });
                        }
                        catch(err) {
                            //rollback transaction
                            self.execute('ROLLBACK', null, function(err) {
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
    executeBatch(batch, callback) {
        callback = callback || function() {};
        callback(new Error('DataAdapter.executeBatch() is obsolete. Use DataAdapter.executeInTransaction() instead.'));
    }

    /**
     * Produces a new identity value for the given entity and attribute.
     * @param {string} entity The target entity name
     * @param {string} attribute The target attribute
     * @param {Function=} callback
     */
    selectIdentity(entity, attribute, callback) {

        const self = this;

        const migration = {
            appliesTo:'increment_id',
            model:'increments',
            description:'Increments migration (version 1.0)',
            version:'1.0',
            add:[
                { name:'id', type:'Counter', primary:true },
                { name:'entity', type:'Text', size:120 },
                { name:'attribute', type:'Text', size:120 },
                { name:'value', type:'Integer' }
            ]
        };
        //ensure increments entity
        self.migrate(migration, function(err)
        {
            //throw error if any
            if (err) { callback.bind(self)(err); return; }

            self.execute('SELECT * FROM increment_id WHERE entity=? AND attribute=?', [entity, attribute], function(err, result) {
                if (err) { callback.bind(self)(err); return; }
                if (result.length===0) {
                    //get max value by querying the given entity
                    const q = QueryExpression.create(entity).select(QueryField.create().max(attribute));
                    self.execute(q,null, function(err, result) {
                        if (err) { callback.bind(self)(err); return; }
                        let value = 1;
                        if (result.length>0) {
                            value = parseInt(result[0][attribute]) + 1;
                        }
                        self.execute('INSERT INTO increment_id(entity, attribute, value) VALUES (?,?,?)',[entity, attribute, value], function(err) {
                            //throw error if any
                            if (err) { callback.bind(self)(err); return; }
                            //return new increment value
                            callback.bind(self)(err, value);
                        });
                    });
                }
                else {
                    //get new increment value
                    const value = parseInt(result[0].value) + 1;
                    self.execute('UPDATE increment_id SET value=? WHERE id=?',[value, result[0].id], function(err) {
                        //throw error if any
                        if (err) { callback.bind(self)(err); return; }
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
    execute(query, values, callback) {
        const self = this;
        let sql = null;
        try {

            if (typeof query === 'string') {
                sql = query;
            }
            else {
                //format query expression or any object that may be act as query expression
                const formatter = new MySqlFormatter();
                formatter.settings.nameFormat = MySqlAdapter.NAME_FORMAT;
                sql = formatter.format(query);
            }
            //validate sql statement
            if (typeof sql !== 'string') {
                callback.bind(self)(new Error('The executing command is of the wrong type or empty.'));
                return;
            }
            //ensure connection
            self.open(function(err) {
                if (err) {
                    callback.bind(self)(err);
                }
                else {
                    let startTime;
                    if (process.env.NODE_ENV==='development') {
                        startTime = new Date().getTime();
                    }
                    //execute raw command
                    self.rawConnection.query(sql, values, function(err, result) {
                        if (process.env.NODE_ENV==='development') {
                            TraceUtils.log(util.format('SQL (Execution Time:%sms):%s, Parameters:%s', (new Date()).getTime()-startTime, sql, JSON.stringify(values)));
                        }
                        callback.bind(self)(err, result);
                    });
                }
            });
        }
        catch (err) {
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
    static format(format, obj) {
        let result = format;
        if (/%t/.test(format))
            result = result.replace(/%t/g,MySqlAdapter.formatType(obj));
        if (/%f/.test(format))
            result = result.replace(/%f/g,obj.name);
        return result;
    }

    static formatType(field) {
        const size = parseInt(field.size);
        const scale = parseInt(field.scale);
        let s = 'varchar(512) NULL';
        const type=field.type;
        switch (type)
        {
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
                s =  'decimal(19,4)';
                break;
            case 'Decimal':
                s =  util.format('decimal(%s,%s)', (size>0 ? size : 19),(scale>0 ? scale : 8));
                break;
            case 'Date':
                s = 'date';
                break;
            case 'DateTime':
            case 'Time':
                s = 'timestamp';
                break;
            case 'Integer':
                s = 'int(11)';
                break;
            case 'Duration':
                s = size>0 ?  util.format('varchar(%s,0)', size) : 'varchar(36)';
                break;
            case 'URL':
            case 'Text':
                s = size>0 ?  `varchar(${size})` : 'varchar(512)';
                break;
            case 'Note':
                s = size>0 ?  `varchar(${size})` : 'text';
                break;
            case 'Image':
            case 'Binary':
                s = size > 0 ? `blob(${size})` : 'blob';
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
        }
        else {
            s += (typeof field.nullable === 'undefined') ? ' null': ((field.nullable===true || field.nullable === 1) ? ' null': ' not null');

        }
        return s;
    }

    /**
     * @param {string} name
     * @param {QueryExpression} query
     * @param {Function} callback
     */
    createView(name, query, callback) {
        this.view(name).create(query, callback);
    }

    /**
     *
     * @param  {DataModelMigration|*} obj - An Object that represents the data model scheme we want to migrate
     * @param {Function} callback
     */
    migrate(obj, callback) {
        if (obj===null)
            return;
        const self = this;
        const migration = obj;
        if (migration.appliesTo===null)
            throw new Error("Model name is undefined");
        self.open(function(err) {
            if (err) {
                callback.bind(self)(err);
            }
            else {
                async.waterfall([
                    //1. Check migrations table existence
                    function(cb) {
                        self.table('migrations').exists(function(err, exists) {
                            if (err) { return cb(err); }
                            cb(null, exists);
                        });
                    },
                    //2. Create migrations table if not exists
                    function(arg, cb) {
                        if (arg>0) { return cb(null, 0); }
                        self.table('migrations').create([
                            { name:'id', type:'Counter', primary:true, nullable:false  },
                            { name:'appliesTo', type:'Text', size:'80', nullable:false  },
                            { name:'model', type:'Text', size:'120', nullable:true  },
                            { name:'description', type:'Text', size:'512', nullable:true  },
                            { name:'version', type:'Text', size:'40', nullable:false  }
                        ], function(err) {
                            if (err) { return cb(err); }
                            cb(null,0);
                        });
                    },
                    //3. Check if migration has already been applied
                    function(arg, cb) {
                        self.execute('SELECT COUNT(*) AS `count` FROM `migrations` WHERE `appliesTo`=? and `version`=?',
                            [migration.appliesTo, migration.version], function(err, result) {
                                if (err) { return cb(err); }
                                cb(null, result[0].count);
                            });
                    },
                    //4a. Check table existence
                    function(arg, cb) {
                        //migration has already been applied (set migration.updated=true)
                        if (arg>0) { obj.updated=true; return cb(null, -1); }
                        self.table(migration.appliesTo).exists(function(err, exists) {
                            if (err) { return cb(err); }
                            cb(null, exists);
                        });
                    },
                    //4b. Migrate target table (create or alter)
                    function(arg, cb) {
                        //migration has already been applied
                        if (arg<0) { return cb(null, arg); }
                        if (arg===0) {
                            //create table
                            return self.table(migration.appliesTo).create(migration.add, function(err) {
                                if (err) { return cb(err); }
                                cb(null, 1);
                            });
                        }
                        //columns to be removed (unsupported)
                        if (_.isArray(migration.remove)) {
                            if (migration.remove.length>0) {
                                return cb(new Error('Data migration remove operation is not supported by this adapter.'));
                            }
                        }
                        //columns to be changed (unsupported)
                        if (_.isArray(migration.change)) {
                            if (migration.change.length>0) {
                                return cb(new Error('Data migration change operation is not supported by this adapter. Use add collection instead.'));
                            }
                        }
                        let column, newType, oldType;
                        if (_.isArray(migration.add)) {
                            //init change collection
                            migration.change = [];
                            //get table columns
                            self.table(migration.appliesTo).columns(function(err, columns) {
                                if (err) { return cb(err); }
                                for (let i = 0; i < migration.add.length; i++) {
                                    const x = migration.add[i];
                                    column = _.find(columns, function(y) { return (y.name===x.name); });
                                    if (column) {
                                        //if column is primary key remove it from collection
                                        if (column.primary) {
                                            migration.add.splice(i, 1);
                                            i-=1;
                                        }
                                        else {
                                            //get new type
                                            newType = MySqlAdapter.format('%t', x);
                                            //get old type
                                            oldType = column.type1.replace(/\s+$/,'') + ((column.nullable===true || column.nullable === 1) ? ' null' : ' not null');
                                            //remove column from collection
                                            migration.add.splice(i, 1);
                                            i-=1;
                                            if (newType !== oldType) {
                                                //add column to alter collection
                                                migration.change.push(x);
                                            }
                                        }
                                    }
                                }
                                //alter table
                                const targetTable = self.table(migration.appliesTo);
                                //add new columns (if any)
                                targetTable.add(migration.add, function(err) {
                                    if (err) { return cb(err); }
                                    //modify columns (if any)
                                    targetTable.change(migration.change, function(err) {
                                        if (err) { return cb(err); }
                                        cb(null, 1);
                                    });
                                });
                            });
                        }
                        else {
                            cb(new Error('Invalid migration data.'));
                        }
                    },
                    //Apply data model indexes
                    function (arg, cb) {
                        if (arg<=0) { return cb(null, arg); }
                        if (migration.indexes) {
                            const tableIndexes = self.indexes(migration.appliesTo);
                            //enumerate migration constraints
                            async.eachSeries(migration.indexes, function(index, indexCallback) {
                                tableIndexes.create(index.name, index.columns, indexCallback);
                            }, function(err) {
                                //throw error
                                if (err) { return cb(err); }
                                //or return success flag
                                return cb(null, 1);
                            });
                        }
                        else {
                            //do nothing and exit
                            return cb(null, 1);
                        }
                    },
                    function(arg, cb) {
                        if (arg>0) {
                            //log migration to database
                            self.execute('INSERT INTO `migrations` (`appliesTo`,`model`,`version`,`description`) VALUES (?,?,?,?)', [migration.appliesTo,
                                migration.model,
                                migration.version,
                                migration.description ], function(err) {
                                if (err) { return cb(err); }
                                return cb(null, 1);
                            });
                        }
                        else
                            cb(null, arg);

                    }
                ], function(err, result) {
                    callback(err, result);
                });
            }
        });
    }

    table(name) {
        const self = this;

        return {
            /**
             * @param {function(Error,Boolean=)} callback
             */
            exists:function(callback) {
                callback = callback || function() {};
                self.execute('SELECT COUNT(*) AS `count` FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_SCHEMA=DATABASE()',
                    [ name ], function(err, result) {
                        if (err) { return callback(err); }
                        callback(null, result[0].count);
                    });
            },
            /**
             * @param {function(Error,string=)} callback
             */
            version:function(callback) {
                callback = callback || function() {};
                self.execute('SELECT MAX(`version`) AS `version` FROM `migrations` WHERE `appliesTo`=?',
                    [name], function(err, result) {
                        if (err) { return callback(err); }
                        if (result.length===0)
                            callback(null, '0.0');
                        else
                            callback(null, result[0].version || '0.0');
                    });
            },
            /**
             * @param {function(Error=,Array=)} callback
             */
            columns:function(callback) {
                callback = callback || function() {};
                self.execute('SELECT COLUMN_NAME AS `name`, DATA_TYPE as `type`, ' +
                    'CHARACTER_MAXIMUM_LENGTH as `size`,CASE WHEN IS_NULLABLE=\'YES\' THEN 1 ELSE 0 END AS `nullable`, ' +
                    'NUMERIC_PRECISION as `precision`, NUMERIC_SCALE as `scale`, ' +
                    'CASE WHEN COLUMN_KEY=\'PRI\' THEN 1 ELSE 0 END AS `primary`, ' +
                    'CONCAT(COLUMN_TYPE, (CASE WHEN EXTRA = NULL THEN \'\' ELSE CONCAT(\' \',EXTRA) END)) AS `type1` ' +
                    'FROM information_schema.COLUMNS WHERE TABLE_NAME=? AND TABLE_SCHEMA=DATABASE()',
                    [ name ], function(err, result) {
                        if (err) { return callback(err); }
                        callback(null, result);
                    });
            },
            /**
             * @param {Array} fields
             * @param {Function} callback
             */
            create: function(fields, callback) {
                callback = callback || function() {};
                fields = fields || [];
                if (!_.isArray(fields)) {
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    return callback(new Error('Invalid argument. Fields collection cannot be empty.'));
                }
                let strFields = _.map(_.filter(fields,(x) => { return !x.oneToMany; }),
                    (x) => {
                        return MySqlAdapter.format('`%f` %t', x);
                    }).join(', ');
                //add primary key constraint
                const strPKFields = _.map(_.filter(fields, (x) => {
                    return (x.primary === true || x.primary === 1);
                }), (x) => {
                    return MySqlAdapter.format('`%f`', x);
                }).join(', ');
                if (strPKFields.length>0) {
                    strFields += ', ' + util.format('PRIMARY KEY (%s)', strPKFields);
                }
                const sql = util.format('CREATE TABLE %s (%s)', name, strFields);
                self.execute(sql, null, function(err) {
                    callback(err);
                });
            },
            /**
             * Alters the table by adding an array of fields
             * @param {{name:string,type:string,primary:boolean|number,nullable:boolean|number,size:number,oneToMany:boolean}[]|*} fields
             * @param callback
             */
            add:function(fields, callback) {
                callback = callback || function() {};
                callback = callback || function() {};
                fields = fields || [];
                if (!_.isArray(fields)) {
                    //invalid argument exception
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    //do nothing
                    return callback();
                }
                const formatter = new MySqlFormatter();
                const strTable = formatter.escapeName(name);
                const statements = _.map(fields, function(x) {
                    return MySqlAdapter.format('ALTER TABLE ' + strTable + ' ADD COLUMN `%f` %t', x);
                });
                return async.eachSeries(statements, function(sql, cb) {
                    self.execute(sql, [], function(err) {
                        return cb(err);
                    });
                }, function(err) {
                    return callback(err);
                });
            },
            /**
             * Alters the table by modifying an array of fields
             * @param {{name:string,type:string,primary:boolean|number,nullable:boolean|number,size:number,oneToMany:boolean}[]|*} fields
             * @param callback
             */
            change:function(fields, callback) {
                callback = callback || function() {};
                callback = callback || function() {};
                fields = fields || [];
                if (!_.isArray(fields)) {
                    //invalid argument exception
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    //do nothing
                    return callback();
                }
                const formatter = new MySqlFormatter();
                const strTable = formatter.escapeName(name);
                const statements = _.map(fields, function(x) {
                    return MySqlAdapter.format('ALTER TABLE ' + strTable + ' MODIFY COLUMN `%f` %t', x);
                });
                return async.eachSeries(statements, function(sql, cb) {
                    self.execute(sql, [], function(err) {
                        return cb(err);
                    });
                }, function(err) {
                    return callback(err);
                });
            }
        };
    }

    view(name) {
        const self = this;
        let owner;
        let view;

        const matches = /(\w+)\.(\w+)/.exec(name);
        if (matches) {
            //get schema owner
            owner = matches[1];
            //get table name
            view = matches[2];
        }
        else {
            view = name;
        }
        return {
            /**
             * @param {function(Error,Boolean=)} callback
             */
            exists:function(callback) {
                const sql = 'SELECT COUNT(*) AS `count` FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_TYPE=\'VIEW\' AND TABLE_SCHEMA=DATABASE()';
                self.execute(sql, [name], function(err, result) {
                    if (err) { callback(err); return; }
                    callback(null, (result[0].count>0));
                });
            },
            /**
             * @param {Function} callback
             */
            drop:function(callback) {
                callback = callback || function() {};
                self.open(function(err) {
                    if (err) { return callback(err); }
                    const sql = 'SELECT COUNT(*) AS `count` FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_TYPE=\'VIEW\' AND TABLE_SCHEMA=DATABASE()';
                    self.execute(sql, [name], function(err, result) {
                        if (err) { return callback(err); }
                        const exists = (result[0].count>0);
                        if (exists) {
                            const sql = util.format('DROP VIEW `%s`',name);
                            self.execute(sql, undefined, function(err) {
                                if (err) { callback(err); return; }
                                callback();
                            });
                        }
                        else {
                            callback();
                        }
                    });
                });
            },
            /**
             * @param {QueryExpression|*} q
             * @param {Function} callback
             */
            create:function(q, callback) {
                const thisArg = this;
                self.executeInTransaction(function(tr) {
                    thisArg.drop(function(err) {
                        if (err) { tr(err); return; }
                        try {
                            let sql = util.format('CREATE VIEW `%s` AS ',name);
                            const formatter = new MySqlFormatter();
                            sql += formatter.format(q);
                            self.execute(sql, [], tr);
                        }
                        catch(e) {
                            tr(e);
                        }
                    });
                }, function(err) {
                    callback(err);
                });

            }
        };
    }

    indexes(table) {
        const self = this, formatter = new MySqlFormatter();
        return {
            list: function (callback) {
                const this1 = this;
                if (this1.hasOwnProperty('indexes_')) {
                    return callback(null, this1['indexes_']);
                }
                self.execute(util.format("SHOW INDEXES FROM `%s`", table), null , function (err, result) {
                    if (err) { return callback(err); }
                    const indexes = [];
                    _.forEach(result, function(x) {
                        const obj = _.find(indexes, function(y) { return y.name === x['Key_name']; });
                        if (typeof obj === 'undefined') {
                            indexes.push({
                                name:x['Key_name'],
                                columns:[ x['Column_name'] ]
                            });
                        }
                        else {
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
            create: function(name, columns, callback) {
                const cols = [];
                if (typeof columns === 'string') {
                    cols.push(columns);
                }
                else if (_.isArray(columns)) {
                    cols.push.apply(cols,columns);
                }
                else {
                    return callback(new Error("Invalid parameter. Columns parameter must be a string or an array of strings."));
                }
                const thisArg = this;
                thisArg.list(function(err, indexes) {

                    if (err) { return callback(err); }
                    const ix =_.find(indexes, function(x) { return x.name === name; });
                    //format create index SQL statement
                    const sqlCreateIndex = util.format("CREATE INDEX %s ON %s(%s)",
                        formatter.escapeName(name),
                        formatter.escapeName(table),
                        _.map(cols, function(x) {
                            return formatter.escapeName(x);
                        }).join(","));
                    if (typeof ix === 'undefined' || ix === null) {
                        self.execute(sqlCreateIndex, [], callback);
                    }
                    else {
                        let nCols = cols.length;
                        //enumerate existing columns
                        _.forEach(ix.columns, function(x) {
                            if (cols.indexOf(x)>=0) {
                                //column exists in index
                                nCols -= 1;
                            }
                        });
                        if (nCols>0) {
                            //drop index
                            thisArg.drop(name, function(err) {
                                if (err) { return callback(err); }
                                //and create it
                                self.execute(sqlCreateIndex, [], callback);
                            });
                        }
                        else {
                            //do nothing
                            return callback();
                        }
                    }
                });


            },
            drop: function(name, callback) {
                if (typeof name !== 'string') {
                    return callback(new Error("Name must be a valid string."));
                }
                this.list(function(err, indexes) {
                    if (err) { return callback(err); }
                    const exists = typeof _.find(indexes, function(x) { return x.name === name; }) !== 'undefined';
                    if (!exists) {
                        return callback();
                    }
                    self.execute(util.format("DROP INDEX %s ON %s", formatter.escapeName(name), formatter.escapeName(table)), [], callback);
                });
            }
        };
    }

    queryFormat(query, values) {
        if (!values) return query;
        const self = this;
        return query.replace(/:(\w+)/g, function (txt, key) {
            if (values.hasOwnProperty(key)) {
                return self.escape(values[key]);
            }
            return txt;
        }.bind(this));
    }
}

function zeroPad(number, length) {
    number = number || 0;
    let res = number.toString();
    while (res.length < length) {
        res = '0' + res;
    }
    return res;
}

/**
 * @class
 * @augments {SqlFormatter}
 */
export class MySqlFormatter extends SqlFormatter {
    /**
     * @constructor
     */
    constructor() {
        super();
        this.settings = {
            nameFormat:MySqlFormatter.NAME_FORMAT,
            forceAlias:true
        };
    }

    escapeName(name) {
        if (typeof name === 'string') {
            if (/^(\w+)\.(\w+)$/g.test(name)) {
                return name.replace(/(\w+)/g, MySqlFormatter.NAME_FORMAT);
            }
            return name.replace(/(\w+)$|^(\w+)$/g, MySqlFormatter.NAME_FORMAT);
        }
        return name;
    }

    escape(value, unquoted) {

        if (typeof value === 'boolean') { return value ? '1' : '0'; }
        if (value instanceof Date) {
            return this.escapeDate(value);
        }
        return super.escape.bind(this)(value, unquoted);
    }

    /**
     * @param {Date|*} val
     * @returns {string}
     */
    escapeDate(val) {
        const year   = val.getFullYear();
        const month  = zeroPad(val.getMonth() + 1, 2);
        const day    = zeroPad(val.getDate(), 2);
        const hour   = zeroPad(val.getHours(), 2);
        const minute = zeroPad(val.getMinutes(), 2);
        const second = zeroPad(val.getSeconds(), 2);
        //var millisecond = zeroPad(val.getMilliseconds(), 3);
        //format timezone
        const offset = val.getTimezoneOffset(), timezone = (offset<=0 ? '+' : '-') + zeroPad(-Math.floor(offset/60),2) + ':' + zeroPad(offset%60,2);
        const datetime = year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
        //convert timestamp to mysql server timezone (by using date object timezone offset)
        return util.format("CONVERT_TZ('%s','%s', @@session.time_zone)", datetime, timezone);
    }
}

MySqlFormatter.NAME_FORMAT = '`$1`';

/**
 * Creates an instance of MySqlAdapter object that represents a MySql database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {*}
 */
export function createInstance(options) {
    return new MySqlAdapter(options);
}