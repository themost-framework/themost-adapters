/*eslint no-var: "off"*/
var gulp = require('gulp');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var eslint = require('gulp-eslint');

var h2Module = [
  'modules/@themost/h2/**/*.es6',
  '!modules/@themost/h2/node_modules/**/*.es6'
];
var mssqlModule = [
  'modules/@themost/mssql/**/*.es6',
  '!modules/@themost/mssql/node_modules/**/*.es6'
];
var mysqlModule = [
  'modules/@themost/mysql/**/*.es6',
  '!modules/@themost/mysql/node_modules/**/*.es6'
];
var oracleModule = [
  'modules/@themost/oracle/**/*.es6',
  '!modules/@themost/oracle/node_modules/**/*.es6'
];
var pgModule = [
    'modules/@themost/pg/**/*.es6',
    '!modules/@themost/pg/node_modules/**/*.es6'
];
var poolModule = [
    'modules/@themost/pool/**/*.es6',
    '!modules/@themost/pool/node_modules/**/*.es6'
];
var sqliteModule = [
    'modules/@themost/sqlite/**/*.es6',
    '!modules/@themost/sqlite/node_modules/**/*.es6'
];

function lint(files, options) {
  return function() {
    return gulp.src(files)
      .pipe(eslint(options))
      .pipe(eslint.format())
  };
}

function build(files) {
  return function () {

    return gulp.src(files)
       // .once('data', bundleTimer.start)
      .pipe(eslint())
      .pipe(eslint.format())
      .pipe(sourcemaps.init())
      .pipe(babel())
      .pipe(sourcemaps.write('.'))
      //  .pipe(bundleTimer)
      .pipe(gulp.dest(function (file) {
        return file.base;
      }));
  }
}

// @themost/h2
gulp.task('build:h2', ['lint:h2'],build(h2Module));


//lint @themost/h2
gulp.task('lint:h2', lint(h2Module));

// @themost/mssql
gulp.task('build:mssql', ['lint:mssql'],build(mssqlModule));

// lint @themost/mssql
gulp.task('lint:mssql',lint(mssqlModule));

// @themost/mysql
gulp.task('build:mysql', ['lint:mysql'],build(mysqlModule));

// lint @themost/mysql
gulp.task('lint:mysql',lint(mysqlModule));

// @themost/oracle
gulp.task('build:oracle', ['lint:oracle'],build(oracleModule));

// lint @themost/oracle
gulp.task('lint:oracle',lint(oracleModule));

// @themost/pg
gulp.task('build:pg', ['lint:pg'],build(pgModule));

// lint @themost/pg
gulp.task('lint:pg',lint(pgModule));

// @themost/pool
gulp.task('build:pool', ['lint:pool'],build(poolModule));

// lint @themost/pool
gulp.task('lint:pool',lint(poolModule));

// @themost/sqlite
gulp.task('build:sqlite', ['lint:sqlite'],build(sqliteModule));

// lint @themost/sqlite
gulp.task('lint:sqlite',lint(sqliteModule));



// lint @themost
gulp.task('lint', ['lint:h2','lint:mssql', 'lint:mysql', 'lint:oracle', 'lint:pg', 'lint:pool', 'lint:sqlite']);

// build @themost
gulp.task('build', ['build:h2','build:mssql', 'build:mysql', 'build:oracle', 'build:pg', 'build:pool', 'build:sqlite']);


gulp.task('debug', ['build'], function () {
  var files = h2Module.concat(mssqlModule, mysqlModule, oracleModule, pgModule, poolModule, sqliteModule);
  gulp.watch(files, function(file) {
    gutil.log(gutil.colors.green('Compiling ' + file.path));
    return build(file.path)();
  });
});

gulp.task('default', ['clean'], function() {
  gulp.start('build');
});