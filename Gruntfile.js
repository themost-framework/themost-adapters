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
                tasks: ["newer:babel:common"],
                options: {
                    spawn: false,
                }
            },
            pool: {
                files: ["modules/@themost/pool/*.es6","!modules/@themost/pool/node_modules/*.es6"],
                tasks: ["newer:babel:common"],
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