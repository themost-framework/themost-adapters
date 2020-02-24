/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2014, Kyriakos Barbounakis k.barbounakis@gmail.com
 *                     Anthi Oikonomou anthioikonomou@gmail.com
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
import {createPool} from 'generic-pool';
import {Args, TraceUtils} from '@themost/common';

const getConfigurationMethod = Symbol('getConfiguration');
const pools = Symbol('pools');


/**
 * @class
 * @property {*} options
 */
export class GenericPoolFactory {
    /**
     * @constructor
     * @param {GenericPoolOptions=} options
     */
    constructor(options) {
        this.options = Object.assign({ }, options);
    }

    create() {
        //if local adapter module has been already loaded
        if (typeof this._adapter !== 'undefined') {
            //create adapter instance and return
            return this._adapter.createInstance(this.options.adapter.options);
        }

        this.options = this.options || { };
        if (typeof this[getConfigurationMethod] !== 'function') {
            throw new TypeError('Configuration getter must be a function.');
        }
        /**
         * @type {ConfigurationBase}
         */
        let configuration = this[getConfigurationMethod]();
        if (configuration == null) {
            throw new TypeError('Configuration cannot be empty at this context.');
        }
        /**
         * @type {ApplicationDataConfiguration}
         */
        let dataConfiguration = configuration.getStrategy(function DataConfigurationStrategy() {
            //
        });
        if (dataConfiguration == null) {
            throw new TypeError('Data configuration cannot be empty at this context.');
        }
        if (typeof dataConfiguration.getAdapterType !== 'function') {
            throw new TypeError('Data configuration adapter getter must be a function.');
        }
        let adapter = dataConfiguration.adapters.find((x)=> {
            return x.name === this.options.adapter;
        });
        if (adapter == null) {
            throw new TypeError('Child data adapter cannot be found.');
        }
        this._adapter = dataConfiguration.getAdapterType(adapter.invariantName);
        //set child adapter
        this.options.adapter = adapter;
        //get child adapter
        return this._adapter.createInstance(this.options.adapter.options);
    }

    destroy(adapter) {
        if (adapter) {
            return adapter.close();
        }
    }

}

/**
 * @class
 */
export class GenericPoolAdapter {
    /**
     * @constructor
     * @property {*} base
     * @property {GenericPoolFactory} pool
     */
    constructor(options) {
        this.options = options;
        const self = this;
        Object.defineProperty(this, 'pool', {
            get: function() {
                return GenericPoolAdapter[pools][self.options.pool];
            }, 
            configurable:false, 
            enumerable:false
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Assigns the given application configuration getter to current object.
     * @param {Function} getConfigurationFunc
     */
    hasConfiguration(getConfigurationFunc) {
        this.pool._factory[getConfigurationMethod] = getConfigurationFunc;
    }

    /**
     * @private
     * @param {GenericPoolAdapterCallback} callback
     */
    open(callback) {
        const self = this;
        if (self.base) {
            return self.base.open(callback);
        }
        // get object from pool
        self.pool.acquire().then( result => {
            TraceUtils.debug(`GenericPoolAdapter: acquire() => borrowed: ${self.pool.borrowed}, pending: ${self.pool.pending}`);
            // set base adapter
            self.base = result;
            //add lastIdentity() method by assigning base.lastIdentity
            if (self.base && typeof self.base.lastIdentity === 'function') {
                Object.assign(self, {
                    lastIdentity(callback) {
                        return this.base.lastIdentity(callback);
                    }
                });
            }
            //add nextIdentity() method by assigning base.nextIdentity
            if (self.base && typeof self.base.nextIdentity === 'function') {
                Object.assign(self, {
                    nextIdentity(entity, attribute, callback) {
                        return this.base.nextIdentity(entity, attribute, callback);
                    }
                });
            }
            return self.base.open(callback);
        }).catch( err => {
            return callback(err);
        });
    }

    /**
     * Closes the underlying database connection
     * @param {GenericPoolAdapterCallback=} callback
     */
    close(callback) {
        callback = callback || function() {};
        if (this.base) {
            // return object to pool
            this.pool.release(this.base);
            TraceUtils.debug(`GenericPoolAdapter: release() => borrowed: ${this.pool.borrowed}, pending: ${this.pool.pending}`);
            // remove lastIdentity() method
            if (typeof this.lastIdentity === 'function') {
                delete this.lastIdentity;
            }
            // remove nextIdentity() method
            if (typeof this.nextIdentity === 'function') {
                delete this.nextIdentity;
            }
            // destroy local object
            delete this.base;
        }
        // exit
        return callback();
    }

    /**
     * Executes a query and returns the result as an array of objects.
     * @param {string|*} query
     * @param {*} values
     * @param {Function} callback
     */
    execute(query, values, callback) {
        const self = this;
        self.open(function(err) {
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
    executeBatch(batch, callback) {
        callback(new Error('This method is obsolete. Use DataAdapter.executeInTransaction() instead.'));
    }

    /**
     * Produces a new identity value for the given entity and attribute.
     * @param entity {String} The target entity name
     * @param attribute {String} The target attribute
     * @param callback {Function=}
     */
    selectIdentity(entity, attribute, callback) {
        const self = this;
        self.open(function(err) {
            if (err) { return callback(err); }
            if (typeof self.base.selectIdentity !== 'function') {
                return callback(new Error('This method is not yet implemented. The base DataAdapter object does not implement this method..'));
            }
            self.base.selectIdentity(entity, attribute , callback);
        });
    }

    /**
     * Creates a database view if the current data adapter supports views
     * @param {string} name A string that represents the name of the view to be created
     * @param {QueryExpression} query The query expression that represents the database vew
     * @param {Function} callback A callback function to be called when operation will be completed.
     */
    createView(name, query, callback) {
        const self = this;
        self.open(function(err) {
            if (err) { return callback(err); }
            self.base.createView(name, query, callback);
        });
    }

    /**
     * Begins a transactional operation by executing the given function
     * @param fn {Function} The function to execute
     * @param callback {Function} The callback that contains the error -if any- and the results of the given operation
     */
    executeInTransaction(fn, callback) {
        const self = this;
        self.open(function(err) {
            if (err) { return callback(err); }
            self.base.executeInTransaction(fn, callback);
        });
    }

    /**
     *
     * @param {*} obj  An Object that represents the data model scheme we want to migrate
     * @param {GenericPoolAdapterCallback} callback
     */
    migrate(obj, callback) {
        const self = this;
        return self.open(function(err) {
            if (err) {
                return callback(err);
            }
            return self.base.migrate(obj, callback);
        });
    }
}
/**
 * @param {GenericPoolOptions} options
 */
export function createInstance(options) {
    Args.check(options.adapter != null, 'Invalid argument. The target data adapter is missing.');
    //init pool collection
    GenericPoolAdapter[pools] = GenericPoolAdapter[pools] || {};
    //get adapter's name
    let name;
    if (typeof options.adapter === 'string') {
        name = options.adapter;
    }
    Args.check(name != null, 'Invalid argument. The target data adapter name is missing.');
    /**
     * @type {*}
     */
    let pool = GenericPoolAdapter[pools][name];
    if (pool == null) {
        //create new pool with the name specified in options
        pool = createPool(new GenericPoolFactory(options), Object.assign({
            // set default max size to 25
            max: 25
        }, options));
        GenericPoolAdapter[pools][name] = pool;
        TraceUtils.debug(`GenericPoolAdapter: createPool() => name: ${name}, min: ${pool.min}, max: ${pool.max}`);
    }
    return new GenericPoolAdapter({ pool:name });
}

process.on('exit', function() {
    if (GenericPoolAdapter[pools] == null) {
        return;
    }
    try {
        const keys = Object.keys(GenericPoolAdapter[pools]);
        keys.forEach(key => {
            if (Object.hasOwnProperty.call(GenericPoolAdapter[pools], key) === false) {
                return;
            }
            try {
                TraceUtils.log(`Cleaning up data pool ${key}`);
                const pool = GenericPoolAdapter[pools][key];
                if (pool == null) {
                    return;
                }
                pool.drain().then(function() {
                    pool.clear();
                });
            }
            catch(err) {
                TraceUtils.error(`An error occurred while cleaning up ${key} pool`);
                TraceUtils.error(err);
            }
        });
    }
    catch(err) {
        TraceUtils.error('An error occurred while cleaning up pools');
        TraceUtils.error(err);
    }

});
