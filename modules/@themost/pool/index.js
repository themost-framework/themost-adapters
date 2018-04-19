'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PoolAdapter = exports.DataPool = undefined;

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

var _util = require('util');

var util = _interopRequireDefault(_util).default;

var _lodash = require('lodash');

var _ = _lodash._;

var _async = require('async');

var async = _interopRequireDefault(_async).default;

var _path = require('path');

var path = _interopRequireDefault(_path).default;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HASH_CODE_LENGTH = 6;

var pools = Symbol('pools');
/**
 * @function
 * @param min
 * @param max
 * @returns {*}
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * max) + min;
}

function randomString(length) {

    length = length || 16;
    var chars = "abcdefghkmnopqursuvwxz2456789ABCDEFHJKLMNPQURSTUVWXYZ";
    var str = "";
    for (var i = 0; i < length; i++) {
        str += chars.substr(randomInt(0, chars.length - 1), 1);
    }
    return str;
}

function randomHex(length) {

    var buffer = new Buffer(randomString(length));
    return buffer.toString('hex');
}

function log(data) {
    util.log(data);
    if (data.stack) {
        util.log(data.stack);
    }
}

function debug(data) {
    if (process.env.NODE_ENV === 'development') log(data);
}

/**
 * @class PoolDictionary
 * @constructor
 */

var PoolDictionary = function () {
    function PoolDictionary() {
        _classCallCheck(this, PoolDictionary);

        var _length = 0;
        Object.defineProperty(this, 'length', {
            get: function get() {
                return _length;
            },
            set: function set(value) {
                _length = value;
            }, configurable: false, enumerable: false
        });
    }

    _createClass(PoolDictionary, [{
        key: 'exists',
        value: function exists(key) {
            return this.hasOwnProperty(key);
        }
    }, {
        key: 'push',
        value: function push(key, value) {
            if (this.hasOwnProperty(key)) {
                this[key] = value;
            } else {
                this[key] = value;
                this.length += 1;
            }
        }
    }, {
        key: 'pop',
        value: function pop(key) {
            if (this.hasOwnProperty(key)) {
                delete this[key];
                this.length -= 1;
                return 1;
            }
            return 0;
        }
    }, {
        key: 'clear',
        value: function clear() {
            var self = this,
                keys = _.keys(this);
            _.forEach(keys, function (x) {
                if (self.hasOwnProperty(x)) {
                    delete self[x];
                    self.length -= 1;
                }
            });
            this.length = 0;
        }
    }, {
        key: 'unshift',
        value: function unshift() {
            for (var key in this) {
                if (this.hasOwnProperty(key)) {
                    var value = this[key];
                    delete this[key];
                    this.length -= 1;
                    return value;
                }
            }
        }
    }]);

    return PoolDictionary;
}();

/**
 * @class
 * @property {*} options
 */


var DataPool = exports.DataPool = function () {
    /**
     * @constructor
     * @param {*=} options
     */
    function DataPool(options) {
        _classCallCheck(this, DataPool);

        this.options = util._extend({ size: 20, reserved: 2, timeout: 30000, lifetime: 1200000 }, options);
        /**
         * A collection of objects which represents the available pooled data adapters.
         */
        this.available = new PoolDictionary();
        /**
         * A collection of objects which represents the pooled data adapters that are currently in use.
         */
        this.inUse = new PoolDictionary();
        /**
         * An array of listeners that are currently waiting for a pooled data adapter.
         * @type {Function[]}
         */
        this.listeners = [];
        //set default state to active
        this.state = 'active';
    }

    _createClass(DataPool, [{
        key: 'createObject',
        value: function createObject() {
            //if local adapter module has been already loaded
            if (typeof this.adapter_ !== 'undefined') {
                //create adapter instance and return
                return this.adapter_.createInstance(this.options.adapter.options);
            }

            this.options = this.options || {};
            /**
             * @type {{adapters:Array, adapterTypes:Array}|*}
             */
            var config = void 0;
            if (global && global.application) {
                var app = global.application;
                config = app.config || { adapters: [], adapterTypes: [] };
            } else {
                //try to load config file
                try {
                    config = require(path.join(process.cwd(), 'app/config.json'));
                } catch (e) {
                    log('Configuration file cannot be loaded due to internal error.');
                    log(e);
                    //config cannot be load (do nothing)
                    config = { adapters: [], adapterTypes: [] };
                }
            }
            var adapter = this.options.adapter,
                er = void 0;
            if (typeof this.options.adapter === 'string') {
                var name = this.options.adapter;
                //try to load adapter settings from configuration
                config.adapters = config.adapters || [];
                var namedAdapter = _.find(config.adapters, function (x) {
                    return x.name === name;
                });
                if (typeof namedAdapter === 'undefined') {
                    er = new Error('The specified data adapter cannot be found.');
                    er.code = 'ECONF';
                    throw er;
                }
                this.options.adapter = namedAdapter;
                adapter = this.options.adapter;
            }
            if (typeof adapter === 'undefined' || adapter === null) {
                er = new Error('The base data adapter cannot be empty at this context.');
                er.code = 'ECONF';
                throw er;
            }
            //get adapter's invariant name
            var adapterType = _.find(config.adapterTypes, function (x) {
                return x.invariantName === adapter.invariantName;
            });
            var adapterModule = void 0;
            if (typeof adapterType === 'undefined') {
                er = new Error('The base data adapter cannot be found.');
                er.code = 'ECONF';
                throw er;
            }
            try {
                adapterModule = require(adapterType.type);
            } catch (e) {
                log(e);
                er = new Error('Base data adapter cannot be loaded due to internal error.');
                er.code = 'ECONF';
                throw er;
            }
            if (typeof adapterModule.createInstance !== 'function') {
                er = new Error('Base data adapter module createInstance() method is missing or is not yet implemented.');
                er.code = 'EMOD';
                throw er;
            }
            //hold adapter module
            this.adapter_ = adapterModule;
            return this.adapter_.createInstance(adapter.options);
        }
    }, {
        key: 'cleanup',
        value: function cleanup(callback) {
            try {
                var self = this;
                self.state = 'paused';
                var keys = _.keys(self.available);
                async.eachSeries(keys, function (key, cb) {
                    var item = self.available[key];
                    if (typeof item === 'undefined' || item === null) {
                        return cb();
                    }
                    if (typeof item.close === 'function') {
                        item.close(function () {
                            cb();
                        });
                    }
                }, function (err) {
                    callback(err);
                    //clear available collection
                    _.forEach(keys, function (key) {
                        delete self.available[key];
                    });
                    self.state = 'active';
                });
            } catch (e) {
                callback(e);
            }
        }

        /**
         * Queries data adapter lifetime in order to release an object which exceeded the defined lifetime limit.
         * If such an object exists, releases data adapter and creates a new one.
         * @private
         * @param {Function} callback
         */

    }, {
        key: 'queryLifetimeForObject',
        value: function queryLifetimeForObject(callback) {
            var self = this;
            var keys = _.keys(self.inUse);
            var newObj = void 0;
            if (keys.length === 0) {
                return callback();
            }
            if (self.options.lifetime > 0) {
                var nowTime = new Date().getTime();
                async.eachSeries(keys, function (hashCode, cb) {
                    var obj = self.inUse[hashCode];
                    if (typeof obj === 'undefined' || obj === null) {
                        return cb();
                    }
                    if (nowTime > obj.createdAt.getTime() + self.options.lifetime) {
                        if (typeof obj.close !== 'function') {
                            return cb();
                        }
                        //close data adapter (the client which is using this adapter may get an error for this, but this data adapter has been truly timed out)
                        obj.close(function () {
                            //create new object (data adapter)
                            newObj = self.createObject();
                            //add createdAt property
                            newObj.createdAt = new Date();
                            //add object hash code property
                            newObj.hashCode = randomHex(HASH_CODE_LENGTH);
                            //delete inUse object
                            delete self.inUse[hashCode];
                            //push object in inUse collection
                            self.inUse[newObj.hashCode] = newObj;
                            //return new object
                            return cb(newObj);
                        });
                    } else {
                        cb();
                    }
                }, function (res) {
                    if (res instanceof Error) {
                        callback(res);
                    } else {
                        callback(null, res);
                    }
                });
            } else {
                callback();
            }
        }

        /**
         * @private
         * @param {Function} callback
         */

    }, {
        key: 'waitForObject',
        value: function waitForObject(callback) {
            var self = this;
            var timeout = void 0;
            var newObj = void 0;
            //register a connection pool timeout
            timeout = setTimeout(function () {
                //throw timeout exception
                var er = new Error('Connection pool timeout.');
                er.code = 'EPTIMEOUT';
                callback(er);
            }, self.options.timeout);
            self.listeners.push(function (releasedObj) {
                //clear timeout
                if (timeout) {
                    clearTimeout(timeout);
                }
                if (releasedObj) {
                    //push (update) released object in inUse collection
                    releasedObj.createdAt = new Date();
                    self.inUse[releasedObj.hashCode] = releasedObj;
                    //return new object
                    return callback(null, releasedObj);
                }
                var keys = _.keys(self.available);
                if (keys.length > 0) {
                    var key = keys[0];
                    //get connection from available connections
                    var pooledObj = self.available[key];
                    delete self.available[key];
                    //push object in inUse collection
                    self.inUse[pooledObj.hashCode] = pooledObj;
                    //return pooled object
                    callback(null, pooledObj);
                } else {
                    //create new object
                    newObj = self.createObject();
                    //add createdAt property
                    newObj.createdAt = new Date();
                    //add object hash code
                    newObj.hashCode = randomHex(HASH_CODE_LENGTH);
                    //push object in inUse collection
                    self.inUse[newObj.hashCode] = newObj;
                    //return new object
                    callback(null, newObj);
                }
            });
        }

        /**
         * @private
         * @param {Function} callback
         */

    }, {
        key: 'newObject',
        value: function newObject(callback) {
            var self = this;
            var newObj = void 0;
            for (var key in self.available) {
                if (self.available.hasOwnProperty(key)) {
                    //get available object
                    newObj = self.available[key];
                    //delete available key from collection
                    delete self.available[key];
                    //add createdAt property
                    newObj.createdAt = new Date();
                    //push object in inUse collection
                    self.inUse[newObj.hashCode] = newObj;
                    //and finally return it
                    return callback(null, newObj);
                }
            }
            //otherwise create new object
            newObj = self.createObject();
            //add createdAt property
            newObj.createdAt = new Date();
            //add object hash code
            newObj.hashCode = randomHex(HASH_CODE_LENGTH);
            //push object in inUse collection
            self.inUse[newObj.hashCode] = newObj;
            //return new object
            return callback(null, newObj);
        }

        /**
         *
         * @param {Function} callback
         */

    }, {
        key: 'getObject',
        value: function getObject(callback) {
            var self = this;
            callback = callback || function () {};

            if (self.state !== 'active') {
                var er = new Error('Connection refused due to pool state.');
                er.code = 'EPSTATE';
                return callback(er);
            }
            var inUseKeys = _.keys(self.inUse);
            debug(util.format("INFO (DataPool): Connections in use:%s", inUseKeys.length));
            if (inUseKeys.length < self.options.size || self.options.size === 0) {
                debug("INFO  (DataPool): Creating new object in data pool.");
                self.newObject(function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null, result);
                });
            } else {
                self.queryLifetimeForObject(function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    if (result) {
                        return callback(null, result);
                    }
                    debug("INFO (DataPool): Waiting for an object from data pool.");
                    self.waitForObject(function (err, result) {
                        if (err) {
                            return callback(err);
                        }
                        callback(null, result);
                    });
                });
            }
        }

        /**
         *
         * @param {*} obj
         * @param {Function} callback
         */

    }, {
        key: 'releaseObject',
        value: function releaseObject(obj, callback) {
            var self = this;
            callback = callback || function () {};
            if (typeof obj === 'undefined' || obj === null) {
                return callback();
            }
            try {
                //get the first listener
                var listener = self.listeners.shift();
                //if listener exists
                if (typeof listener === 'function') {
                    //execute listener
                    if (typeof obj.hashCode === 'undefined' || obj.hashCode === null) {
                        //generate hashCode
                        obj.hashCode = randomHex(HASH_CODE_LENGTH);
                    }
                    if (self.inUse.hasOwnProperty(obj.hashCode)) {
                        //call listener with the released object as parameter
                        listener.call(self, obj);
                    } else {
                        //validate released object
                        if (typeof obj.close === 'function') {
                            try {
                                //call close() method
                                obj.close();
                                //call listener without any parameter
                                listener.call(self);
                            } catch (e) {
                                log('An error occured while trying to release an unknown data adapter');
                                log(e);
                                //call listener without any parameter
                                listener.call(self);
                            }
                        }
                    }
                } else {
                    //search inUse collection
                    debug("INFO (DataPool): Releasing object from data pool.");
                    var used = this.inUse[obj.hashCode];
                    if (typeof used !== 'undefined') {
                        //delete used adapter
                        delete this.inUse[obj.hashCode];
                        //push data adapter to available collection
                        self.available[used.hashCode] = used;
                        debug(util.format("INFO (DataPool): Object released. Connections in use %s.", this.inUse.length));
                    }
                }
                //finally exit
                callback();
            } catch (e) {
                callback(e);
            }
        }
    }]);

    return DataPool;
}();

/**
 * @class
 */


var PoolAdapter = exports.PoolAdapter = function () {
    /**
     * @constructor
     * @augments DataAdapter
     * @property {DataAdapter} base
     * @property {DataPool} pool
     */
    function PoolAdapter(options) {
        _classCallCheck(this, PoolAdapter);

        this.options = options;
        var self = this;
        Object.defineProperty(this, 'pool', {
            get: function get() {
                return DataPool[pools][self.options.pool];
            }, configurable: false, enumerable: false
        });
    }

    /**
     * @private
     * @param callback
     */


    _createClass(PoolAdapter, [{
        key: 'open',
        value: function open(callback) {
            var self = this;
            if (self.base) {
                return self.base.open(callback);
            } else {
                self.pool.getObject(function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    self.base = result;
                    if (typeof self.base.lastIdentity === 'function') {
                        self.lastIdentity = function (callback) {
                            return this.base.lastIdentity(callback);
                        };
                    }
                    self.base.open(callback);
                });
            }
        }

        /**
         * Closes the underlying database connection
         * @param callback {function(Error=)}
         */

    }, {
        key: 'close',
        value: function close(callback) {
            callback = callback || function () {};
            var self = this;
            if (self.base) {
                self.pool.releaseObject(self.base, callback);
                if (typeof self.base.lastIdentity === 'function') {
                    delete self.lastIdentity;
                }
                delete self.base;
            } else {
                callback();
            }
        }

        /**
         * Executes a query and returns the result as an array of objects.
         * @param query {string|*}
         * @param values {*}
         * @param callback {Function}
         */

    }, {
        key: 'execute',
        value: function execute(query, values, callback) {
            var self = this;
            self.open(function (err) {
                if (err) {
                    return callback(err);
                }
                self.base.execute(query, values, callback);
            });
        }

        /**
         * Executes an operation against database and returns the results.
         * @param batch {*}
         * @param callback {Function=}
         */

    }, {
        key: 'executeBatch',
        value: function executeBatch(batch, callback) {
            callback(new Error('This method is obsolete. Use DataAdapter.executeInTransaction() instead.'));
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
            self.open(function (err) {
                if (err) {
                    return callback(err);
                }
                if (typeof self.base.selectIdentity !== 'function') {
                    return callback(new Error('This method is not yet implemented. The base DataAdapter object does not implement this method..'));
                }
                self.base.selectIdentity(entity, attribute, callback);
            });
        }

        /**
         * Creates a database view if the current data adapter supports views
         * @param {string} name A string that represents the name of the view to be created
         * @param {QueryExpression} query The query expression that represents the database vew
         * @param {Function} callback A callback function to be called when operation will be completed.
         */

    }, {
        key: 'createView',
        value: function createView(name, query, callback) {
            var self = this;
            self.open(function (err) {
                if (err) {
                    return callback(err);
                }
                self.base.createView(name, query, callback);
            });
        }

        /**
         * Begins a transactional operation by executing the given function
         * @param fn {Function} The function to execute
         * @param callback {Function} The callback that contains the error -if any- and the results of the given operation
         */

    }, {
        key: 'executeInTransaction',
        value: function executeInTransaction(fn, callback) {
            var self = this;
            self.open(function (err) {
                if (err) {
                    return callback(err);
                }
                self.base.executeInTransaction(fn, callback);
            });
        }

        /**
         *
         * @param obj {DataModelMigration|*} An Object that represents the data model scheme we want to migrate
         * @param callback {Function}
         */

    }, {
        key: 'migrate',
        value: function migrate(obj, callback) {
            var self = this;
            self.open(function (err) {
                if (err) {
                    return callback(err);
                }
                self.base.migrate(obj, callback);
            });
        }
    }]);

    return PoolAdapter;
}();
/**
 * @param {*} options
 */


function createInstance(options) {
    var name = void 0,
        er = void 0;
    if (typeof options.adapter === 'undefined' || options.adapter === null) {
        er = new Error('Invalid argument. The target data adapter is missing.');
        er.code = 'EARG';
        throw er;
    }
    //init pool collection
    DataPool[pools] = DataPool[pools] || {};

    //get adapter's name
    if (typeof options.adapter === 'string') {
        name = options.adapter;
    } else if (typeof options.adapter.name === 'string') {
        name = options.adapter.name;
    }
    //validate name
    if (typeof name === 'undefined') {
        er = new Error('Invalid argument. The target data adapter name is missing.');
        er.code = 'EARG';
        throw er;
    }
    /**
     * @type {DataPool}
     */
    var pool = DataPool[pools][name];
    if (typeof pool === 'undefined' || pool === null) {
        //create new pool with the name specified in options
        DataPool[pools][name] = new DataPool(options);
    }
    return new PoolAdapter({ pool: name });
}

process.on('exit', function () {
    if (_.isNil(DataPool[pools])) {
        return;
    }
    try {
        var keys = _.keys(DataPool[pools]);
        _.forEach(keys, function (x) {
            try {
                log(util.format('Cleaning up data pool (%s)', x));
                if (typeof DataPool[pools][x] === 'undefined' || DataPool[pools][x] === null) {
                    return;
                }
                if (typeof DataPool[pools][x].cleanup === 'function') {
                    DataPool[pools][x].cleanup(function () {
                        //do nothing
                    });
                }
            } catch (err) {
                debug(err);
            }
        });
    } catch (err) {
        debug(err);
    }
});
//# sourceMappingURL=index.js.map
