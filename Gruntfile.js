/**
 * @license
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2014, Kyriakos Barbounakis k.barbounakis@gmail.com
 *                     Anthi Oikonomou anthioikonomou@gmail.com
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */
/**
 * @param {*} grunt
 */
module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.initConfig({
        babel: {
            sqlite: {
                files: [{
                    "expand": true,
                    "cwd":"modules/@themost/sqlite",
                    "src": ["*.es6","!node_modules/**/*.es6"],
                    "dest": "modules/@themost/sqlite",
                    "ext": ".js"
                }]
            },
            pool: {
                files: [{
                    "expand": true,
                    "cwd":"modules/@themost/pool",
                    "src": ["*.es6","!node_modules/**/*.es6"],
                    "dest": "modules/@themost/pool",
                    "ext": ".js"
                }]
            },
            mysql: {
                files: [{
                    "expand": true,
                    "cwd":"modules/@themost/mysql",
                    "src": ["*.es6","!node_modules/**/*.es6"],
                    "dest": "modules/@themost/mysql",
                    "ext": ".js"
                }]
            },
            mssql: {
                files: [{
                    "expand": true,
                    "cwd":"modules/@themost/mssql",
                    "src": ["*.es6","!node_modules/**/*.es6"],
                    "dest": "modules/@themost/mssql",
                    "ext": ".js"
                }]
            },
            pg: {
                files: [{
                    "expand": true,
                    "cwd":"modules/@themost/pg",
                    "src": ["*.es6","!node_modules/**/*.es6"],
                    "dest": "modules/@themost/pg",
                    "ext": ".js"
                }]
            },
            oracle: {
                files: [{
                    "expand": true,
                    "cwd":"modules/@themost/oracle",
                    "src": ["*.es6","!node_modules/**/*.es6"],
                    "dest": "modules/@themost/oracle",
                    "ext": ".js"
                }]
            },
            h2: {
                files: [{
                    "expand": true,
                    "cwd":"modules/@themost/h2",
                    "src": ["*.es6","!node_modules/**/*.es6"],
                    "dest": "modules/@themost/h2",
                    "ext": ".js"
                }]
            },
            test: {
                files: [{
                    "expand": true,
                    "cwd":"",
                    "src": ["test/**/*.es6"],
                    "dest": "",
                    "ext": ".js"
                }]
            }
        },
        watch: {
            sqlite: {
                files: ["modules/@themost/sqlite/*.es6","!modules/@themost/sqlite/node_modules/*.es6"],
                tasks: ["newer:babel:sqlite"],
                options: {
                    spawn: false,
                }
            },
            pool: {
                files: ["modules/@themost/pool/*.es6","!modules/@themost/pool/node_modules/*.es6"],
                tasks: ["newer:babel:pool"],
                options: {
                    spawn: false,
                }
            },
            mysql: {
                files: ["modules/@themost/mysql/*.es6","!modules/@themost/mysql/node_modules/*.es6"],
                tasks: ["newer:babel:mysql"],
                options: {
                    spawn: false,
                }
            },
            mssql: {
                files: ["modules/@themost/mssql/*.es6","!modules/@themost/mssql/node_modules/*.es6"],
                tasks: ["newer:babel:mssql"],
                options: {
                    spawn: false,
                }
            },
            pg: {
                files: ["modules/@themost/pg/*.es6","!modules/@themost/pg/node_modules/*.es6"],
                tasks: ["newer:babel:mssql"],
                options: {
                    spawn: false,
                }
            },
            oracle: {
                files: ["modules/@themost/oracle/*.es6","!modules/@themost/oracle/node_modules/*.es6"],
                tasks: ["newer:babel:mssql"],
                options: {
                    spawn: false,
                }
            },
            h2: {
                files: ["modules/@themost/h2/*.es6","!modules/@themost/h2/node_modules/*.es6"],
                tasks: ["newer:babel:mssql"],
                options: {
                    spawn: false,
                }
            },
            test: {
                files: ["test/**/*.es6"],
                tasks: ["newer:babel:test"],
                options: {
                    spawn: false,
                },
            }
        },
    });
    grunt.loadNpmTasks('grunt-newer');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.registerTask('default', ['babel']);
};