/**
 * @license
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2014, Kyriakos Barbounakis k.barbounakis@gmail.com
 *                     Anthi Oikonomou anthioikonomou@gmail.com
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
import JDBC from 'jdbc';
import jinst from 'jdbc/lib/jinst';
import async from 'async';
import path from 'path';
import util from 'util';
import _ from 'lodash';
import {SqlFormatter} from '@themost/query/formatter';
import {QueryExpression,QueryField} from "@themost/query/query";
import {TraceUtils} from '@themost/common/utils';
import {SqlUtils} from '@themost/query/utils';


if (!jinst.isJvmCreated()) {
    jinst.addOption("-Xrs");
    jinst.setupClasspath([ path.resolve(__dirname, './drivers/h2-latest.jar')]);
}


/**
 * @class
 * @augments DataAdapter
 */
export class H2Adapter {
    /**
     * @constructor
     * @param {*} options
     */
    constructor(options) {
        /**
         * @private
         * @type {Connection}
         */
        this.rawConnection = null;

        if (_.isNil(options)) {
            throw new Error("Data adapter options may not be empty.");
        }

        this.getOptions = function() {
            let result;
            //build URL
            if (typeof options.path === 'string') {
                result = {
                    url : util.format("jdbc:h2:%s;AUTO_SERVER=true;AUTO_RECONNECT=true", path.resolve(process.cwd(), options.path)),
                    minpoolsize:1,
                    maxpoolsize: typeof options.pool === 'number' ? options.pool : 25,
                    properties : {
                        "user" : options.user,
                        "password": options.password
                    }
                };
                return result;
            }
            else if (typeof options.host === 'string') {
                const host_ = options.port ? options.host + ":" + options.port : options.host;
                result = {
                    url : util.format("jdbc:h2:tcp://%s/%s;AUTO_RECONNECT=true", host_, options.database),
                    minpoolsize:1,
                    maxpoolsize: typeof options.pool === 'number' ? options.pool : 25,
                    properties : {
                        "user" : options.user,
                        "password": options.password
                    }
                };
                return result;
            }
            else {
                throw new Error("Database path or host may not be empty.");
            }
        };

    }

    /**
     * Opens database connection
     */
    open(callback) {
        callback = callback || function() {};
        const self = this;
        if (self.rawConnection) {
            return callback();
        }
        H2Adapter.pools = H2Adapter.pools || { };

        //get connection options
        const options = this.getOptions();

        let connectionPool;
        if (H2Adapter.pools.hasOwnProperty(options.url)) {
            connectionPool=H2Adapter.pools[options.url];
            connectionPool.reserve(function(err, connObj) {
                if (err) { return callback(err); }
                self.rawConnection = connObj;
                return callback();
            });
        }
        else {
            connectionPool = new JDBC(self.getOptions());
            H2Adapter.pools[options.url] = connectionPool;
            connectionPool.initialize(function(err) {
                if (err) { return callback(err); }
                connectionPool.reserve(function(err, connObj) {
                    if (err) { return callback(err); }
                    self.rawConnection = connObj;
                    return callback();
                });
            });
        }
    }

    /**
     * @param {function(Error=)} callback
     */
    close(callback) {
        const self = this;
        callback = callback || function() {};
        if (typeof self.rawConnection === 'undefined' || self.rawConnection === null) {
            return callback();
        }
        H2Adapter.pools = H2Adapter.pools || { };
        const options = this.getOptions(), connectionPool=H2Adapter.pools[options.url];
        if (typeof connectionPool === 'undefined' || connectionPool === null) {
            return callback(new Error("Connection pool may not be empty at this context."));
        }
        connectionPool.release(self.rawConnection, function(err) {
            if (err) {
                TraceUtils.log(err);
            }
            self.rawConnection=null;
            return callback();
        });
    }

    /**
     * Begins a data transaction and executes the given function
     * @param fn {Function}
     * @param callback {Function}
     */
    executeInTransaction(fn, callback) {
        const self = this;
        //ensure callback
        callback = callback || function () {};
        //ensure that database connection is open
        self.open(function(err) {
            if (err) {
                return callback(err);
            }
            //execution is already in transaction
            if (self.transaction_) {
                //so invoke method
                fn.call(self, function(err)
                {
                    //call callback
                    return callback(err);
                });
            }
            else {
                //set auto commit to off
                return self.rawConnection.conn.setAutoCommit(false, function() {
                    if (err) { return callback(err); }
                    //set savepoint
                    self.transaction_ = true;
                    try {
                        //invoke method
                        fn.call(self, function(error)
                        {
                            if (error) {
                                self.rawConnection.conn.rollback(function(err) {
                                    if (err) {
                                        //log transaction rollback error
                                        TraceUtils.log("An error occured while rolling back savepoint.");
                                        TraceUtils.log(err);
                                    }
                                    delete self.transaction_;
                                    return self.rawConnection.conn.setAutoCommit(true, function() {
                                        return callback(error);
                                    });
                                });
                            }
                            else {
                                self.rawConnection.conn.commit(function(err) {
                                    delete self.transaction_;
                                    return self.rawConnection.conn.setAutoCommit(true, function() {
                                        return callback(err);
                                    });
                                });
                            }
                        });
                    }
                    catch(e) {
                        self.rawConnection.conn.rollback(function(err) {
                            if (err) {
                                //log transaction rollback error
                                TraceUtils.log("An error occured while rolling back savepoint.");
                                TraceUtils.log(err);
                            }
                            delete self.transaction_;
                            return self.rawConnection.conn.setAutoCommit(true, function() {
                                return callback(e);
                            });
                        });
                    }
                });
            }
        });
    }

    /**
     * Executes an operation against database and returns the results.
     * @param batch {*}
     * @param callback {Function}
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
            if (err) { callback.call(self,err); return; }

            self.execute('SELECT * FROM "increment_id" WHERE "entity"=? AND "attribute"=?', [entity, attribute], function(err, result) {
                if (err) { callback.call(self,err); return; }
                if (result.length===0) {
                    //get max value by querying the given entity
                    const q = QueryExpression.create(entity).select(QueryField.create().max(attribute));
                    self.execute(q,null, function(err, result) {
                        if (err) { callback.call(self, err); return; }
                        let value = 1;
                        if (result.length>0) {
                            value = parseInt(result[0][attribute]) + 1;
                        }
                        self.execute('INSERT INTO "increment_id"("entity", "attribute", "value") VALUES (?,?,?)',[entity, attribute, value], function(err) {
                            //throw error if any
                            if (err) { callback.call(self, err); return; }
                            //return new increment value
                            callback.call(self, err, value);
                        });
                    });
                }
                else {
                    //get new increment value
                    const value = parseInt(result[0].value) + 1;
                    self.execute('UPDATE "increment_id" SET "value"=? WHERE "id"=?',[value, result[0].id], function(err) {
                        //throw error if any
                        if (err) { callback.call(self, err); return; }
                        //return new increment value
                        callback.call(self, err, value);
                    });
                }
            });
        });
    }

    lastIdentity(callback) {
        const self = this;
        self.open(function(err) {
            if (err) {
                callback(err);
            }
            else {
                self.execute('SELECT SCOPE_IDENTITY() as "lastval"', [], function(err, result) {
                    if (err) {
                        callback(null, { insertId: null });
                    }
                    else {
                        result = result || [];
                        if (result.length>0)
                            callback(null, { insertId:parseInt(result[0]["lastval"]) });
                        else
                            callback(null, { insertId: null });
                    }
                });
            }
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
                const formatter = new H2Formatter();
                formatter.settings.nameFormat = H2Adapter.NAME_FORMAT;
                sql = formatter.format(query);
            }
            //validate sql statement
            if (typeof sql !== 'string') {
                callback.call(self, new Error('The executing command is of the wrong type or empty.'));
                return;
            }
            //ensure connection
            self.open(function(err) {
                if (err) {
                    callback.call(self, err);
                }
                else {

                    let startTime;
                    if (process.env.NODE_ENV==='development') {
                        startTime = new Date().getTime();
                    }
                    //execute raw command
                    const str = SqlUtils.format(sql, values);
                    self.rawConnection.conn.createStatement(function(err, statement) {
                        if (err) { return callback(err); }
                        let executeQuery = statement.executeQuery;
                        if (!/^SELECT/i.test(str)) {
                            executeQuery = statement.executeUpdate;
                        }
                        executeQuery.call(statement, str, function(err, result) {
                            if (process.env.NODE_ENV==='development') {
                                TraceUtils.log(util.format('SQL (Execution Time:%sms):%s, Parameters:%s', (new Date()).getTime()-startTime, sql, JSON.stringify(values)));
                            }
                            if (err) {
                                return callback(err);
                            }
                            if (typeof result.toObjArray === 'function') {
                                result.toObjArray(function(err, results) {
                                    return callback(null, results);
                                });
                            }
                            else {
                                return callback(null, result);
                            }
                        });
                    });
                }
            });
        }
        catch (e) {
            callback.call(self, e);
        }
    }

    /**
     * Formats an object based on the format string provided. Valid formats are:
     * %t : Formats a field and returns field type definition
     * %f : Formats a field and returns field name
     * @param format {string}
     * @param obj {*}
     */
    static format(format, obj) {
        let result = format;
        if (/%t/.test(format))
            result = result.replace(/%t/g,H2Adapter.formatType(obj));
        if (/%f/.test(format))
            result = result.replace(/%f/g,obj.name);
        return result;
    }

    static formatType(field) {
        const size = parseInt(field.size);
        const scale = parseInt(field.scale);
        let s = 'VARCHAR(512) NULL';
        const type=field.type;
        switch (type)
        {
            case 'Boolean':
                s = 'BOOLEAN';
                break;
            case 'Byte':
                s = 'TINYINT';
                break;
            case 'Number':
            case 'Float':
                s = 'REAL';
                break;
            case 'Counter':
                return 'INT AUTO_INCREMENT NOT NULL';
            case 'Currency':
                s =  'DECIMAL(19,4)';
                break;
            case 'Decimal':
                s =  util.format('DECIMAL(%s,%s)', (size>0 ? size : 19),(scale>0 ? scale : 8));
                break;
            case 'Date':
                s = 'DATE';
                break;
            case 'DateTime':
                s = 'TIMESTAMP';
                break;
            case 'Time':
                s = 'TIME';
                break;
            case 'Integer':
                s = 'INTEGER';
                break;
            case 'Duration':
                s = size>0 ?  util.format('VARCHAR(%s)', size) : 'VARCHAR(48)';
                break;
            case 'BigInteger':
                s = 'BIGINT';
                break;
            case 'URL':
                s = size>0 ?  util.format('VARCHAR(%s)', size) : 'VARCHAR(512)';
                break;
            case 'Text':
                s = size>0 ?  util.format('VARCHAR(%s)', size) : 'VARCHAR(512)';
                break;
            case 'Note':
                s = size>0 ?  util.format('VARCHAR(%s)', size) : 'CLOB';
                break;
            case 'Image':
            case 'Binary':
                s = size > 0 ? util.format('BLOB(%s)', size) : 'BLOB';
                break;
            case 'Guid':
                s = 'VARCHAR(36)';
                break;
            case 'Short':
                s = 'SMALLINT';
                break;
            default:
                s = 'INTEGER';
                break;
        }
        s += (typeof field.nullable=== 'undefined') ? ' null': (field.nullable===true || field.nullable === 1) ? ' NULL': ' NOT NULL';
        return s;
    }

    /**
     * @param {string} name
     * @param {QueryExpression} query
     * @param {function(Error=)} callback
     */
    createView(name, query, callback) {
        this.view(name).create(query, callback);
    }

    /**
     *
     * @param  {DataModelMigration|*} obj - An Object that represents the data model scheme we want to migrate
     * @param {function(Error=,*=)} callback
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
                callback.call(self, err);
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
                        self.execute('SELECT COUNT(*) AS "count" FROM "migrations" WHERE "appliesTo"=? and "version"=?',
                            [migration.appliesTo, migration.version], function(err, result) {
                                if (err) { return cb(err); }
                                cb(null, parseInt(result[0].count));
                            });
                    },
                    //4a. Check table existence
                    function(arg, cb) {
                        //migration has already been applied (set migration.updated=true)
                        if (arg>0) { obj['updated']=true; cb(null, -1); return; }
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
                        if (util.isArray(migration.remove)) {
                            if (migration.remove.length>0) {
                                return cb(new Error('Data migration remove operation is not supported by this adapter.'));
                            }
                        }
                        //columns to be changed (unsupported)
                        if (util.isArray(migration.change)) {
                            if (migration.change.length>0) {
                                return cb(new Error('Data migration change operation is not supported by this adapter. Use add collection instead.'));
                            }
                        }
                        let column, newType, oldType;
                        if (util.isArray(migration.add)) {
                            //init change collection
                            migration.change = [];
                            //get table columns
                            self.table(migration.appliesTo).columns(function(err, columns) {
                                if (err) { return cb(err); }
                                for (let i = 0; i < migration.add.length; i++) {
                                    const x = migration.add[i];
                                    column = _.find(columns, (y)=> {
                                        return (y.name===x.name);
                                    });
                                    if (column) {
                                        //if column is primary key remove it from collection
                                        if (column.primary) {
                                            migration.add.splice(i, 1);
                                            i-=1;
                                        }
                                        else {
                                            //get new type
                                            newType = H2Adapter.format('%t', x);
                                            //get old type
                                            oldType = column.type1.replace(/\s+$/,'') + ((column.nullable===true || column.nullable === 1) ? ' NULL' : ' NOT NULL');
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
                    //Apply data model foreign keys
                    function (arg, cb) {
                        if (arg<=0) { return cb(null, arg); }
                        if (migration.constraints) {
                            const tableForeignKeys = self.foreignKeys(migration.appliesTo);
                            //enumerate migration constraints
                            async.eachSeries(migration.constraints, function(constraint, constraintCallback) {
                                //if constraint is a foreign key constraint
                                if (constraint.type === 'foreignKey') {
                                    //create table foreign key
                                    return tableForeignKeys.create(constraint.foreignKeyField,
                                        constraint.primaryKeyTable,
                                        constraint.primaryKeyField,
                                        constraintCallback);
                                }
                                else {
                                    //else do nothing
                                    return constraintCallback();
                                }
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
                    }, function(arg, cb) {
                        if (arg>0) {
                            //log migration to database
                            self.execute('INSERT INTO "migrations" ("appliesTo","model","version","description") VALUES (?,?,?,?)', [migration.appliesTo,
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
                self.execute('SELECT COUNT(*) AS "count" FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_SCHEMA=?',
                    [ name, 'PUBLIC' ], function(err, result) {
                        if (err) { return callback(err); }
                        callback(null, parseInt(result[0].count));
                    });
            },
            /**
             * @param {function(Error,string=)} callback
             */
            version:function(callback) {
                callback = callback || function() {};
                self.execute('SELECT MAX("version") AS "version" FROM "migrations" WHERE "appliesTo"=?',
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
                self.execute('SELECT COLUMN_NAME AS "name", TYPE_NAME as "type",CHARACTER_MAXIMUM_LENGTH as "size", ' +
                'CASE WHEN IS_NULLABLE=\'YES\' THEN 1 ELSE 0 END AS "nullable", NUMERIC_PRECISION as "precision",' +
                'NUMERIC_SCALE as "scale" ,(SELECT COUNT(*) FROM information_schema.INDEXES WHERE TABLE_CATALOG="c".TABLE_CATALOG AND TABLE_SCHEMA="c".TABLE_SCHEMA AND TABLE_NAME="c".TABLE_NAME ' +
                'AND PRIMARY_KEY=true AND COLUMN_NAME="c".COLUMN_NAME) AS "primary" ,CONCAT(TYPE_NAME, (CASE WHEN "NULLABLE" = 0 THEN \' NOT NULL\' ELSE \'\' END)) ' +
                'AS "type1" FROM information_schema.COLUMNS AS "c" WHERE TABLE_NAME=? AND TABLE_SCHEMA=?',
                    [ name, 'PUBLIC' ], function(err, result) {
                        if (err) { return callback(err); }
                        callback(null, result);
                    });
            },
            /**
             * @param {{name:string,type:string,primary:boolean|number,nullable:boolean|number,size:number, scale:number,precision:number,oneToMany:boolean}[]|*} fields
             * @param callback
             */
            create: function(fields, callback) {
                callback = callback || function() {};
                fields = fields || [];
                if (!util.isArray(fields)) {
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    return callback(new Error('Invalid argument. Fields collection cannot be empty.'));
                }
                let strFields = fields.filter(function(x) {
                    return !x.oneToMany;
                }).map(
                    function(x) {
                        return H2Adapter.format('"%f" %t', x);
                    }).join(', ');
                //add primary key constraint
                const strPKFields = fields.filter(function(x) { return (x.primary === true || x.primary === 1); }).map(function(x) {
                    return H2Adapter.format('"%f"', x);
                }).join(', ');
                if (strPKFields.length>0) {
                    strFields += ', ' + util.format('PRIMARY KEY (%s)', strPKFields);
                }
                const sql = util.format('CREATE TABLE "%s" (%s)', name, strFields);
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
                if (!util.isArray(fields)) {
                    //invalid argument exception
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    //do nothing
                    return callback();
                }
                const formatter = new H2Formatter();
                const strTable = formatter.escapeName(name);
                //generate SQL statement
                const sql = fields.map(function(x) {
                    return H2Adapter.format('ALTER TABLE ' + strTable + ' ADD "%f" %t', x);
                }).join(';');
                self.execute(sql, [], function(err) {
                    callback(err);
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
                if (!util.isArray(fields)) {
                    //invalid argument exception
                    return callback(new Error('Invalid argument type. Expected Array.'));
                }
                if (fields.length === 0) {
                    //do nothing
                    return callback();
                }
                const formatter = new H2Formatter();
                const strTable = formatter.escapeName(name);
                //generate SQL statement
                const sql = fields.map(function(x) {
                    return H2Adapter.format('ALTER TABLE ' + strTable + ' ALTER COLUMN "%f" %t', x);
                }).join(';');
                self.execute(sql, [], function(err) {
                    callback(err);
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
                const sql = 'SELECT COUNT(*) AS "count" FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_TYPE=\'VIEW\' AND TABLE_SCHEMA=?';
                self.execute(sql, [name, 'PUBLIC'], function(err, result) {
                    if (err) { callback(err); return; }
                    callback(null, (result[0].count>0));
                });
            },
            /**
             * @param {function(Error=)} callback
             */
            drop:function(callback) {
                callback = callback || function() {};
                self.open(function(err) {
                    if (err) { return callback(err); }
                    const sql = 'SELECT COUNT(*) AS "count" FROM information_schema.TABLES WHERE TABLE_NAME=? AND TABLE_TYPE=\'VIEW\' AND TABLE_SCHEMA=?';
                    self.execute(sql, [name, 'PUBLIC'], function(err, result) {
                        if (err) { return callback(err); }
                        const exists = (result[0].count>0);
                        if (exists) {
                            const sql = util.format('DROP VIEW "%s"',name);
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
             * @param {function(Error=)} callback
             */
            create:function(q, callback) {
                const thisArg = this;
                self.executeInTransaction(function(tr) {
                    thisArg.drop(function(err) {
                        if (err) { return tr(err); }
                        try {
                            let sql = util.format('CREATE VIEW "%s" AS ',name);
                            const formatter = new H2Formatter();
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
      const self = this, formatter = new H2Formatter();
        return {
            list: function (callback) {
                self.execute('SELECT INDEX_NAME as "indexName", TABLE_NAME as "tableName", COLUMN_NAME as "columnName" FROM "INFORMATION_SCHEMA".INDEXES ' +
                    'WHERE TABLE_NAME=? AND TABLE_SCHEMA=? AND INDEX_TYPE_NAME=\'INDEX\'', [ table, 'PUBLIC'] , function (err, result) {
                    if (err) { return callback(err); }
                    const indexes = [];
                    _.forEach(result,
                        /**
                         * @param {{indexName:string, columnName:string}} x
                         */
                        function(x) {
                       const ix = indexes.find(function(y) {
                          return y.name === x.indexName;
                       });
                        if (ix) {
                            ix.columns.push(x.columnName);
                        }
                        else {
                            indexes.push({
                                name:x.indexName,
                                columns: [ x.columnName ]
                            });
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
                else if (util.isArray(columns)) {
                    cols.push.apply(cols, columns);
                }
                else {
                    return callback(new Error("Invalid parameter. Columns parameter must be a string or an array of strings."));
                }
                const thisArg = this;
                thisArg.list(function(err, indexes) {
                   if (err) { return callback(err); }
                   const ix = indexes.find(function(x) { return x.name === name; });
                    //format create index SQL statement
                    const sqlCreateIndex = util.format("CREATE INDEX %s ON %s(%s)",
                        formatter.escapeName(name),
                        formatter.escapeName(table),
                        cols.map(function(x) {
                            return formatter.escapeName(x);
                        }).join(","));
                    if (typeof ix === 'undefined' || ix === null) {
                        self.execute(sqlCreateIndex, [], callback);
                    }
                    else {
                        let nCols = cols.length;
                        //enumerate existing columns
                        ix.columns.forEach(function(x) {
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
                self.execute('SELECT COUNT(*) as "count" FROM "INFORMATION_SCHEMA".INDEXES WHERE  TABLE_NAME=? AND TABLE_SCHEMA=? AND INDEX_NAME=?', [ table, 'PUBLIC', name ], function(err, result) {
                    if (err) { return callback(err); }
                    const exists = (result.length>0) && (result[0].count>0);
                    if (!exists) {
                        return callback();
                    }
                    self.execute(util.format("DROP INDEX %s", self.escapeName(name)), [], callback);
                });
            }
        };
    }

    foreignKeys(table) {
      const self = this;
        return {
            /**
             * Gets the collection of the foreign keys associated with the given table
             * @param callback
             */
            list:function (callback) {
                self.execute('SELECT FK_NAME as "foreignKeyName" ,PKTABLE_NAME as "primaryKeyTable",PKCOLUMN_NAME as "primaryKeyColumn", ' +
                    'FKTABLE_NAME as "foreignKeyTable",FKCOLUMN_NAME as "foreignKeyColumn" ' +
                    'FROM "INFORMATION_SCHEMA".CROSS_REFERENCES WHERE FKTABLE_NAME=? AND FKTABLE_SCHEMA=?', [ table, "PUBLIC" ], function(err, result) {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null, result);
                });
            },
            /**
             * Creates a foreign key association between two tables
             * @param {string} foreignKeyColumn
             * @param {string} primaryKeyTable
             * @param {string} primaryKeyColumn
             * @param {Function} callback
             */
            create:function(foreignKeyColumn, primaryKeyTable, primaryKeyColumn, callback) {
                self.execute('SELECT COUNT(*) as "count" FROM "INFORMATION_SCHEMA".CROSS_REFERENCES ' +
                    'WHERE FKTABLE_NAME=? AND FKTABLE_SCHEMA=? AND FKCOLUMN_NAME=? AND PKTABLE_NAME=? AND PKCOLUMN_NAME=?',
                    [ table, "PUBLIC", foreignKeyColumn, primaryKeyTable, primaryKeyColumn ], function(err, result) {
                    if (err) {
                        return callback(err);
                    }
                    //if foreign key already exists
                    if (result[0] && result[0].count>0) {
                        return callback();
                    }
                    const sql = util.format('ALTER TABLE "%s" ADD FOREIGN KEY ("%s") REFERENCES "%s"("%s")', table, foreignKeyColumn, primaryKeyTable, primaryKeyColumn);
                    self.execute(sql, [], function(err) {
                        return callback(err);
                    });
                });
            },
            /**
             * Drops a foreign key association between two tables
             * @param {string} foreignKeyColumn
             * @param {string} primaryKeyTable
             * @param {string} primaryKeyColumn
             * @param {Function} callback
             */
            drop:function(foreignKeyColumn, primaryKeyTable, primaryKeyColumn, callback) {
                self.execute('SELECT FK_NAME as "foreignKeyName" FROM "INFORMATION_SCHEMA".CROSS_REFERENCES ' +
                    'WHERE FKTABLE_NAME=? AND FKTABLE_SCHEMA=? AND FKCOLUMN_NAME=? AND PKTABLE_NAME=? AND PKCOLUMN_NAME=?',
                    [ table, "PUBLIC", foreignKeyColumn, primaryKeyTable, primaryKeyColumn ], function(err, result) {
                        if (err) {
                            return callback(err);
                        }
                        if (result[0]) {
                            const sql = util.format('ALTER TABLE "%s" DROP CONSTRAINT "%s";', table, result[0].foreignKeyName);
                            self.execute(sql, [], function(err) {
                                return callback(err);
                            });
                        }
                        else {
                            return callback();
                        }
                    });
            }
        };
    }

    /**
     * Gets the database timezone
     * @param {Function} callback
     */
    getDatabaseTimezone(callback) {
    return this.execute('SELECT FORMATDATETIME(CURRENT_TIMESTAMP(),\'XXX\') as "timezone"', null, function (err, result) {
        if (err) { return callback(err); }
        return callback(null, result[0]["timezone"]);
    });
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
export class H2Formatter extends SqlFormatter {
    /**
     * @constructor
     */
    constructor() {
        super();
        this.settings = {
            nameFormat:H2Formatter.NAME_FORMAT,
            forceAlias:true
        };
    }

    escapeName(name) {
        if (typeof name === 'string') {
            if (/^(\w+)\.(\w+)$/g.test(name)) {
                return name.replace(/(\w+)/g, H2Formatter.NAME_FORMAT);
            }
            return name.replace(/(\w+)$|^(\w+)$/g, H2Formatter.NAME_FORMAT);
        }
        return name;
    }

    escape(value, unquoted) {
        if (value===null || typeof value==='undefined')
            return SqlUtils.escape(null);

        if(typeof value==='string') {
            if (unquoted) {
                return value.replace(/'/g, "''");
            }
            return '\'' + value.replace(/'/g, "''") + '\'';
        }

        if (typeof value==='boolean')
            return value ? 1 : 0;
        if (typeof value === 'object')
        {
            if (value instanceof Date)
                return this.escapeDate(value);
            if (value.hasOwnProperty('$name'))
                return this.escapeName(value.$name);
        }
        if (unquoted)
            return value.valueOf();
        else
            return SqlUtils.escape(value);
    }

    /**
     * @param {Date|*} val
     * @returns {string}
     */
    escapeDate(val) {
        /*
        Important Note
        H2 database engine uses server timezone while inserting date values.
        
        Tip #1: convert date to GMT: new Date(val.valueOf() + val.getTimezoneOffset() * 60000); 
        */
        const year   = val.getFullYear();
        const month  = zeroPad(val.getMonth() + 1, 2);
        const day    = zeroPad(val.getDate(), 2);
        const hour   = zeroPad(val.getHours(), 2);
        const minute = zeroPad(val.getMinutes(), 2);
        const second = zeroPad(val.getSeconds(), 2);
        const datetime = year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
        const offset = val.getTimezoneOffset(), timezone = (offset<=0 ? '+' : '-') + zeroPad(-Math.floor(offset/60),2) + ':' + zeroPad(offset%60,2);
        return "'" + datetime.concat(timezone) + "'";
    }

    /**
     * Implements length(a) expression formatter.
     * @param {*} p0
     * @returns {string}
     */
    $length(p0) {
        return util.format('LENGTH(%s)', this.escape(p0));
    }

    $day(p0) {
        return util.format('DAY_OF_MONTH(%s)', this.escape(p0));
    }

    $date(p0) {
        return util.format('CAST(%s AS DATE)', this.escape(p0));
    }

    $mod(p0, p1) {
        //validate params
        if (_.isNil(p0) || _.isNil(p1))
            return '0';
        return util.format('MOD(%s,%s)', this.escape(p0), this.escape(p1));
    }

    $bit(p0, p1) {
        //validate params
        if (_.isNil(p0) || _.isNil(p1))
            return '0';
        return util.format('BITAND(%s,%s)', this.escape(p0), this.escape(p1));
    }
}

H2Formatter.NAME_FORMAT = '"$1"';

/**
 * Creates an instance of H2Adapter object that represents a MySql database connection.
 * @param {*} options An object that represents the properties of the underlying database connection.
 * @returns {DataAdapter}
 */
export function createInstance(options) {
    return new H2Adapter(options);
}