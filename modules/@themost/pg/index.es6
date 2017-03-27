/**
 * @license
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2014, Kyriakos Barbounakis k.barbounakis@gmail.com
 *                     Anthi Oikonomou anthioikonomou@gmail.com
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
'use strict';
import pg from 'pg';
import async from 'async';
import util from 'util';
import {_} from 'lodash';
import {SqlFormatter} from '@themost/query/formatter';
import {QueryExpression,QueryField} from "@themost/query/query";
import {SqlUtils} from "@themost/query/utils";
import {TraceUtils} from "themost/common/utils";


pg.types.setTypeParser(20, function(val) {
    return val === null ? null : parseInt(val);
});

pg.types.setTypeParser(1700, function(val) {
    return val === null ? null : parseFloat(val);
});


/**
 * @class
 * @augments {DataAdapter}
 */
export class PGSqlAdapter {
    /**
     * @constructor
     * @param {*} options
     */
    constructor(options) {
        this.rawConnection = null;
        /**
         * @type {*}
         */
        this.transaction = null;
        /**
         * @type {*}
         */
        this.options = options || { };
        if (typeof this.options.port === 'undefined')
            this.options.port = 5432;
        if (typeof this.options.host === 'undefined')
            this.options.host = 'localhost';
        //define connection string
        const self = this;
        Object.defineProperty(this, 'connectionString', { get: function() {
            return util.format('postgres://%s:%s@%s:%s/%s',
                self.options.user,
                self.options.password,
                self.options.host,
                self.options.port,
                self.options.database);
        }, enumerable:false, configurable:false});
    }

    /**
     * Opens a new database connection
     * @param {function(Error=)} callback
     */
    connect(callback) {

        const self = this;
        callback = callback || function() {};
        if (self.rawConnection) {
            callback();
            return;
        }
        self.rawConnection = new pg.Client(this.connectionString);

        let startTime;
        if (process.env.NODE_ENV==='development') {
            startTime = new Date().getTime();
        }
        //try to connection
        self.rawConnection.connect(function(err) {
            if(err) {
                self.rawConnection = null;
                return callback(err);
            }
            if (process.env.NODE_ENV==='development') {
                console.log(util.format('SQL (Execution Time:%sms): Connect', (new Date()).getTime()-startTime));
            }
            //and return
            callback(err);
        });
    }

    /**
     * Opens a new database connection
     * @param {function(Error=)} callback
     */
    open(callback) {
        callback = callback || function() {};
        if (this.rawConnection) { return callback(); }
        this.connect(callback);
    }

    /**
     * Closes the underlying database connection
     * @param {function(Error=)} callback
     */
    disconnect(callback) {
        callback = callback || function() {};
        if (typeof this.rawConnection === 'undefined' || this.rawConnection===null) {
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
        }
        catch(e) {
            console.log('An error occurred while trying to close database connection. ' + e.message);
            this.rawConnection = null;
            //do nothing (do not raise an error)
            callback();
        }
    }

    /**
     * Closes the underlying database connection
     * @param {function(Error=)} callback
     */
    close(callback) {
        callback = callback || function() {};
        this.disconnect(callback);
    }

    /**
     * @param {string} query
     * @param {*=} values
     */
    prepare(query, values) {
        return SqlUtils.prepare(query,values);
    }

    /**
     * Executes a query against the underlying database
     * @param {string|*} query
     * @param values {*=}
     * @param {function(Error=,*=)} callback
     */
    execute(query, values, callback) {
        const self = this;
        let sql = null;
        try {

            if (typeof query === 'string') {
                //get raw sql statement
                sql = query;
            }
            else {
                //format query expression or any object that may be act as query expression
                const formatter = new PGSqlFormatter();
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
                    //log statement (optional)
                    let startTime;
                    const prepared = self.prepare(sql, values);
                    if (process.env.NODE_ENV==='development') {
                        startTime = new Date().getTime();
                    }
                    //execute raw command
                    self.rawConnection.query(prepared, null, function(err, result) {
                        if (process.env.NODE_ENV==='development') {
                            console.log(util.format('SQL (Execution Time:%sms):%s, Parameters:%s', (new Date()).getTime()-startTime, prepared, JSON.stringify(values)));
                        }
                        if (err) {
                            //log sql
                            console.log(util.format('SQL Error:%s', prepared));
                            callback(err);
                        }
                        else {
                            callback(null, result.rows);
                        }
                    });
                }
            });
        }
        catch (e) {
            callback.call(self, e);
        }
    }

    lastIdentity(callback) {
        const self = this;
        self.open(function(err) {
            if (err) {
                callback(err);
            }
            else {
                //execute lastval (for sequence)
                self.rawConnection.query('SELECT lastval()', null, function(err, lastval) {
                    if (err) {
                        callback(null, { insertId: null });
                    }
                    else {
                        lastval.rows = lastval.rows || [];
                        if (lastval.rows.length>0)
                            callback(null, { insertId:lastval.rows[0]['lastval'] });
                        else
                            callback(null, { insertId: null });
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
    executeInTransaction(fn, callback) {
        const self = this;
        //ensure parameters
        fn = fn || function() {}; callback = callback || function() {};
        self.open(function(err) {
            if (err) {
                callback(err);
            }
            else {
                if (self.transaction) {
                    fn.call(self, function(err) {
                        callback(err);
                    });
                }
                else {
                    //begin transaction
                    self.rawConnection.query('BEGIN TRANSACTION;', null, function(err) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        //initialize dummy transaction object (for future use)
                        self.transaction = { };
                        //execute function
                        fn.call(self, function(err) {
                            if (err) {
                                //rollback transaction
                                self.rawConnection.query('ROLLBACK TRANSACTION;', null, function() {
                                    self.transaction = null;
                                    callback(err);
                                });
                            }
                            else {
                                //commit transaction
                                self.rawConnection.query('COMMIT TRANSACTION;', null, function(err) {
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
            self.execute('SELECT * FROM increment_id WHERE entity=? AND attribute=?', [entity, attribute], function(err, result) {
                if (err) { callback.call(self,err); return; }
                if (result.length===0) {
                    //get max value by querying the given entity
                    const q = QueryExpression.create(entity).select(QueryField.create().max(attribute));
                    self.execute(q,null, function(err, result) {
                        if (err) { return callback.call(self, err); }
                        let value = 1;
                        if (result.length>0) {
                            value = parseInt(result[0][attribute]) + 1;
                        }
                        self.execute('INSERT INTO increment_id(entity, attribute, value) VALUES (?,?,?)',[entity, attribute, value], function(err) {
                            //throw error if any
                            if (err) { return callback.call(self, err); }
                            //return new increment value
                            callback.call(self, err, value);
                        });
                    });
                }
                else {
                    //get new increment value
                    const value = parseInt(result[0].value) + 1;
                    self.execute('UPDATE increment_id SET value=? WHERE id=?',[value, result[0].id], function(err) {
                        //throw error if any
                        if (err) { return callback.call(self, err); }
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
    executeBatch(batch, callback) {
        callback = callback || function() {};
        callback(new Error('DataAdapter.executeBatch() is obsolete. Use DataAdapter.executeInTransaction() instead.'));
    }

    /**
     *
     * @param {*|{type:string, size:number, nullable:boolean}} field
     * @param {string=} format
     * @returns {string}
     */
    static formatType(field, format) {
        const size = parseInt(field.size);
        const scale = parseInt(field.scale);
        let s = 'varchar(512) NULL';
        const type=field.type;
        switch (type)
        {
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
                s =  util.format('decimal(%s,%s)', (size>0? size: 19), (scale>0 ? scale: 4));
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
                s = 'integer';
                break;
            case 'URL':
                if (size>0)
                    s =  util.format('varchar(%s)', size);
                else
                    s =  'varchar';
                break;
            case 'Text':
                if (size>0)
                    s =  util.format('varchar(%s)', size);
                else
                    s =  'varchar';
                break;
            case 'Note':
                if (size>0)
                    s =  util.format('varchar(%s)', size);
                else
                    s =  'text';
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
        if (format==='alter')
            s += (typeof field.nullable === 'undefined') ? ' DROP NOT NULL': (field.nullable ? ' DROP NOT NULL': ' SET NOT NULL');
        else
            s += (typeof field.nullable === 'undefined') ? ' NULL': (field.nullable ? ' NULL': ' NOT NULL');
        return s;
    }

    refreshView(name, query, callback) {
        const formatter = new PGSqlFormatter();
        this.execute('REFRESH MATERIALIZED VIEW ' + formatter.escapeName(name), null, function(err) {
            callback(err);
        });
    }

    /**
     * @param query {QueryExpression}
     */
    createView(name, query, callback) {
        const self = this;
        //open database
        self.open(function(err) {
            if (err) {
                callback.call(self, err);
                return;
            }
            //begin transaction
            self.executeInTransaction(function(tr)
            {
                async.waterfall([
                    function(cb) {
                        self.execute('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\'public\' AND table_type=\'VIEW\' AND table_name=?', [ name ],function(err, result) {
                            if (err) { throw err; }
                            if (result.length===0)
                                return cb(null, 0);
                            cb(null, result[0].count);
                        });
                    },
                    function(arg, cb) {
                        if (arg===0) { cb(null, 0); return; }
                        //format query
                        const sql = util.format("DROP VIEW \"%s\"",name);
                        self.execute(sql, null, function(err, result) {
                            if (err) { throw err; }
                            cb(null, 0);
                        });
                    },
                    function(arg, cb) {
                        //format query
                        const formatter = new PGSqlFormatter();
                        formatter.settings.nameFormat = PGSqlAdapter.NAME_FORMAT;
                        const sql = util.format("CREATE VIEW \"%s\" AS %s", name, formatter.format(query));
                        self.execute(sql, null, function(err, result) {
                            if (err) { throw err; }
                            cb(null, 0);
                        });
                    }
                ], function(err) {
                    if (err) { tr(err); return; }
                    tr(null);
                });
            }, function(err) {
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
    table(name) {
        const self = this;
        return {
            /**
             * @param {function(Error,Boolean=)} callback
             */
            exists: function(callback) {
                callback = callback || function() {};
                self.execute('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\'public\' AND table_type=\'BASE TABLE\' AND table_name=?',
                    [name], function(err, result) {
                        if (err) { callback(err); return; }
                        callback(null, (result[0].count>0));
                    });
            },
            /**
             * @param {function(Error,string=)} callback
             */
            version:function(callback) {
                self.execute('SELECT MAX("version") AS version FROM migrations WHERE "appliesTo"=?',
                    [name], function(err, result) {
                        if (err) { callback(err); return; }
                        if (result.length===0)
                            callback(null, '0.0');
                        else
                            callback(null, result[0].version || '0.0');
                    });
            },
            /**
             * @param {function(Error,Boolean=)} callback
             */
            has_sequence:function(callback) {
                callback = callback || function() {};
                self.execute('SELECT COUNT(*) FROM information_schema.columns WHERE table_name=? AND table_schema=\'public\' AND ("column_default" ~ \'^nextval\((.*?)\)$\')',
                    [name], function(err, result) {
                        if (err) { callback(err); return; }
                        callback(null, (result[0].count>0));
                    });
            },
            /**
             * @param {function(Error,{columnName:string,ordinal:number,dataType:*, maxLength:number,isNullable:number }[]=)} callback
             */
            columns:function(callback) {
                callback = callback || function() {};
                self.execute('SELECT column_name AS "columnName", ordinal_position as "ordinal", data_type as "dataType",' +
                    'character_maximum_length as "maxLength", is_nullable AS  "isNullable", column_default AS "defaultValue"' +
                    ' FROM information_schema.columns WHERE table_name=?',
                    [name], function(err, result) {
                        if (err) { callback(err); return; }
                        callback(null, result);
                    });
            }
        };
    }

    /*
    * @param obj {DataModelMigration|*} An Object that represents the data model scheme we want to migrate
    * @param callback {Function}
    */
    migrate(obj, callback) {
        if (obj===null)
            return;
        const self = this;
        /**
         * @type {DataModelMigration|*}
         */
        const migration = obj;

        const format = function(format, obj)
        {
            let result = format;
            if (/%t/.test(format))
                result = result.replace(/%t/g,PGSqlAdapter.formatType(obj));
            if (/%f/.test(format))
                result = result.replace(/%f/g,obj.name);
            return result;
        };

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
                        if (PGSqlAdapter.supportMigrations) {
                            cb(null, 1);
                            return;
                        }
                        self.table('migrations').exists(function(err, exists) {
                            if (err) { cb(err); return; }
                            cb(null, exists);
                        });
                    },
                    //2. Create migrations table if not exists
                    function(arg, cb) {
                        if (arg>0) { cb(null, 0); return; }
                        //create migrations table
                        self.execute('CREATE TABLE migrations(id SERIAL NOT NULL, ' +
                                '"appliesTo" varchar(80) NOT NULL, "model" varchar(120) NULL, "description" varchar(512),"version" varchar(40) NOT NULL)',
                            ['migrations'], function(err) {
                                if (err) { cb(err); return; }
                                PGSqlAdapter.supportMigrations=true;
                                cb(null, 0);
                            });
                    },
                    //3. Check if migration has already been applied
                    function(arg, cb) {
                        self.table(migration.appliesTo).version(function(err, version) {
                            if (err) { cb(err); return; }
                            cb(null, (version>=migration.version));
                        });

                    },
                    //4a. Check table existence
                    function(arg, cb) {
                        //migration has already been applied (set migration.updated=true)
                        if (arg) {
                            obj['updated']=true;
                            return cb(null, -1);
                        }
                        else {
                            self.table(migration.appliesTo).exists(function(err, exists) {
                                if (err) { cb(err); return; }
                                cb(null, exists ? 1 : 0);
                            });

                        }
                    },
                    //4b. Get table columns
                    function(arg, cb) {
                        //migration has already been applied
                        if (arg<0) { cb(null, [arg, null]); return; }
                        self.table(migration.appliesTo).columns(function(err, columns) {
                            if (err) { cb(err); return; }
                            cb(null, [arg, columns]);
                        });
                    },
                    //5. Migrate target table (create or alter)
                    function(args, cb)
                    {
                        //migration has already been applied
                        if (args[0]<0) { cb(null, args[0]); return; }
                        const columns = args[1];
                        if (args[0]===0) {
                            //create table and
                            const strFields = _.map(_.filter(migration.add, (x) => {
                                return !x.oneToMany;
                            }),(x) => {
                                    return format('\"%f\" %t', x);
                                }).join(', ');
                            const key = _.find(migration.add, (x) => { return x.primary; });
                            const sql = util.format('CREATE TABLE \"%s\" (%s, PRIMARY KEY(\"%s\"))', migration.appliesTo, strFields, key.name);
                            self.execute(sql, null, function(err)
                            {
                                if (err) { return cb(err); }
                                return cb(null, 1);
                            });

                        }
                        else {
                            const expressions = [];
                            let column;
                            let fname;
                            const findColumnFunc = (name) => {
                                return _.find(this, (x) => {
                                    return x.columnName === name;
                                });
                            };
                            //1. enumerate fields to delete
                            if (migration.remove) {
                                for(let i=0;i<migration.remove.length;i++) {
                                    fname=migration.remove[i].name;
                                    column = findColumnFunc.bind(columns)(fname);
                                    if (typeof column !== 'undefined') {
                                        let k= 1, deletedColumnName =util.format('xx%s1_%s', k.toString(), column.columnName);
                                        while(typeof findColumnFunc.bind(columns)(deletedColumnName) !=='undefined') {
                                            k+=1;
                                            deletedColumnName =util.format('xx%s_%s', k.toString(), column.columnName);
                                        }
                                        expressions.push(util.format('ALTER TABLE \"%s\" RENAME COLUMN \"%s\" TO %s', migration.appliesTo, column.columnName, deletedColumnName));
                                    }
                                }
                            }
                            //2. enumerate fields to add
                            let newSize, originalSize, fieldName, nullable;
                            if (migration.add)
                            {
                                for(let i=0;i<migration.add.length;i++)
                                {
                                    //get field name
                                    fieldName = migration.add[i].name;
                                    //check if field exists or not
                                    column = findColumnFunc.bind(columns)(fieldName);
                                    if (typeof column !== 'undefined') {
                                        //get original field size
                                        originalSize = column.maxLength;
                                        //and new field size
                                        newSize = migration.add[i].size;
                                        //add expression for modifying column (size)
                                        if ((typeof newSize !== 'undefined') && (originalSize!==newSize)) {
                                            expressions.push(util.format('UPDATE pg_attribute SET atttypmod = %s+4 WHERE attrelid = \'"%s"\'::regclass AND attname = \'%s\';',newSize, migration.appliesTo,  fieldName));
                                        }
                                        //update nullable attribute
                                        nullable = (typeof migration.add[i].nullable !=='undefined') ? migration.add[i].nullable  : true;
                                        expressions.push(util.format('ALTER TABLE \"%s\" ALTER COLUMN \"%s\" %s', migration.appliesTo, fieldName, (nullable ? 'DROP NOT NULL' : 'SET NOT NULL')));
                                    }
                                    else {
                                        //add expression for adding column
                                        expressions.push(util.format('ALTER TABLE \"%s\" ADD COLUMN \"%s\" %s', migration.appliesTo, fieldName, PGSqlAdapter.formatType(migration.add[i])));
                                    }
                                }
                            }

                            //3. enumerate fields to update
                            if (migration.change) {
                                for(var i=0;i<migration.change.length;i++) {
                                    const change = migration.change[i];
                                    column = findColumnFunc.bind(columns)(change);
                                    if (typeof column !== 'undefined') {
                                        //important note: Alter column operation is not supported for column types
                                        expressions.push(util.format('ALTER TABLE \"%s\" ALTER COLUMN \"%s\" TYPE %s', migration.appliesTo, migration.add[i].name, PGSqlAdapter.formatType(migration.change[i])));
                                    }
                                }
                            }

                            if (expressions.length>0) {
                                self.execute(expressions.join(';'), null, function(err)
                                {
                                    if (err) { cb(err); return; }
                                    return cb(null, 1);
                                });
                            }
                            else
                                cb(null, 2);
                        }
                    }, function(arg, cb) {

                        if (arg>0) {
                            //log migration to database
                            self.execute('INSERT INTO migrations("appliesTo", "model", "version", "description") VALUES (?,?,?,?)', [migration.appliesTo,
                                migration.model,
                                migration.version,
                                migration.description ], function(err, result)
                            {
                                if (err) throw err;
                                return cb(null, 1);
                            });
                        }
                        else {
                            migration['updated'] = true;
                            cb(null, arg);
                        }
                    }
                ], function(err, result) {
                    callback(err, result);
                });
            }
        });
    }
}

PGSqlAdapter.NAME_FORMAT = '"$1"';

/**
 * @class
 * @augments {SqlFormatter}
 */
export class PGSqlFormatter extends SqlFormatter {
    /**
     * @constructor
     */
    constructor() {
        super();
        this.settings = {
            nameFormat:PGSqlAdapter.NAME_FORMAT
        };
    }

    /**
     *
     * @param {QueryExpression|{$take:number=,$skip:number=}} obj
     * @returns {string}
     */
    formatLimitSelect(obj) {
        let sql=this.formatSelect(obj);
        if (obj.$take) {
            if (obj.$skip)
            //add limit and skip records
                sql= sql.concat(' LIMIT ', obj.$take.toString() ,' OFFSET ',obj.$skip.toString());
            else
            //add only limit
                sql= sql.concat(' LIMIT ',  obj.$take.toString());
        }
        return sql;
    }

    escapeConstant(obj, quoted) {
        let res = this.escape(obj, quoted);
        if (typeof obj === 'undefined' || obj === null)
            res += '::text';
        else if (obj instanceof Date)
            res += '::timestamp';
        else if (typeof obj === 'number')
            res += '::float';
        else if (typeof obj === 'boolean')
            res += '::bool';
        else
            res += '::text';
        return res;
    }

    /**
     * Escapes an object or a value and returns the equivalent sql value.
     * @param {*} value - A value that is going to be escaped for SQL statements
     * @param {boolean=} unquoted - An optional value that indicates whether the resulted string will be quoted or not.
     * @returns {string} - The equivalent SQL string value
     */
    escape(value, unquoted) {
        let res = super.escape.bind(this)(value, unquoted);
        if (typeof value === 'string') {
            if (/\\'/g.test(res))
                res = res.replace(/\\'/g, SINGLE_QUOTE_ESCAPE);
            if (/\\"/g.test(res))
                res = res.replace(/\\"/g, DOUBLE_QUOTE_ESCAPE);
        }
        return res;
    }

    /**
     * Implements indexOf(str,substr) expression formatter.
     * @param {String} p0 The source string
     * @param {String} p1 The string to search for
     */
    $indexof(p0, p1) {

        return util.format('POSITION(lower(%s) IN lower(%s::text))', this.escape(p1), this.escape(p0));
    }

    /**
     * Implements regular expression formatting.
     * @param {*} p0 - An object or string that represents the field which is going to be used in this expression.
     * @param {string|*} p1 - A string that represents the text to search for
     * @returns {string}
     */
    $regex(p0, p1) {
        //validate params
        if (Object.isNullOrUndefined(p0) || Object.isNullOrUndefined(p1))
            return '';
        return util.format('(%s ~ \'%s\')', this.escape(p0), this.escape(p1, true));
    }

    /**
     * Implements startsWith(a,b) expression formatter.
     * @param p0 {*}
     * @param p1 {*}
     */
    $startswith(p0, p1) {
        //validate params
        if (Object.isNullOrUndefined(p0) || Object.isNullOrUndefined(p1))
            return '';
        return util.format('(%s ~ \'^%s\')', this.escape(p0), this.escape(p1, true));
    }

    /**
     * Implements endsWith(a,b) expression formatter.
     * @param p0 {*}
     * @param p1 {*}
     */
    $endswith(p0, p1) {
        //validate params
        if (Object.isNullOrUndefined(p0) || Object.isNullOrUndefined(p1))
            return '';
        const result = util.format('(%s ~ \'%s$$\')', this.escape(p0), this.escape(p1, true));
        return result;
    }

    /**
     * Implements substring(str,pos) expression formatter.
     * @param {String} p0 The source string
     * @param {Number} pos The starting position
     * @param {Number=} length The length of the resulted string
     * @returns {string}
     */
    $substring(p0, pos, length) {
        if (length)
            return util.format('SUBSTRING(%s FROM %s FOR %s)', this.escape(p0), pos.valueOf()+1, length.valueOf());
        else
            return util.format('SUBSTRING(%s FROM %s)', this.escape(p0), pos.valueOf()+1);
    }

    /**
     * Implements contains(a,b) expression formatter.
     * @param p0 {*}
     * @param p1 {*}
     */
    $contains(p0, p1) {
        //validate params
        if (Object.isNullOrUndefined(p0) || Object.isNullOrUndefined(p1))
            return '';
        if (p1.valueOf().toString().length===0)
            return '';
        return util.format('(%s ~ \'%s\')', this.escape(p0), this.escape(p1, true));
    }

    escapeName(name) {
        if (typeof name === 'string')
            return name.replace(/(\w+)/ig, this.settings.nameFormat);
        return name;
    }

    /**
     * Implements length(a) expression formatter.
     * @param p0 {*}
     */
    $length(p0) {
        return util.format('LENGTH(%s)', this.escape(p0));
    }

    $day(p0) { return util.format('DATE_PART(\'day\',%s)', this.escape(p0)); }
    $month(p0) { return util.format('DATE_PART(\'month\',%s)', this.escape(p0)); }
    $year(p0) { return util.format('DATE_PART(\'year\',%s)', this.escape(p0)); }
    $hour(p0) { return util.format('HOUR_TZ(%s::timestamp with time zone)', this.escape(p0)); }
    $minute(p0) { return util.format('DATE_PART(\'minute\',%s)', this.escape(p0)); }
    $second(p0) { return util.format('DATE_PART(\'second\',%s)', this.escape(p0)); }

    $date(p0) {
        return util.format('CAST(%s AS DATE)', this.escape(p0));
    }
}

const SINGLE_QUOTE_ESCAPE ='\'\'',
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
export function createInstance(options) {
    return new PGSqlAdapter(options);
}
