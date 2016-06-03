/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

const depcheck = require('depcheck');
const mergeStream = require('merge-stream');
const fs = require('fs-extra');
const gulp = require('gulp');
const eslint = require('gulp-eslint');
const mocha = require('gulp-mocha');
const path = require('path');
const rename = require('gulp-rename');
const runSeq = require('run-sequence');
const stream = require('stream');
const tslint = require('gulp-tslint');
const typescript = require('gulp-typescript');
const typings = require('gulp-typings');
const uglify = require('gulp-uglify');

const npmProject = typescript.createProject('tsconfig.json');
const bowerProject = typescript.createProject('tsconfig.json', {
  target: 'es5',
  module: 'amd',
  outFile: './polymer-expressions.js',
  outDir: null,
  rootDir: './src',
});

gulp.task('init', () => gulp.src("./typings.json").pipe(typings()));

gulp.task('lint', ['tslint', 'eslint', 'depcheck']);

gulp.task('build-npm', () =>
  npmProject.src()
		.pipe(typescript(npmProject))
  	.pipe(gulp.dest('lib/')));

gulp.task('build-bower', () => {
  let compileResult = bowerProject.src().pipe(typescript(bowerProject));
  let unminifiedResult = new ForkedVinylStream(compileResult);
  let minifiedResult = new ForkedVinylStream(compileResult);

  return mergeStream(
  	unminifiedResult,
    minifiedResult
      .pipe(uglify({
          compress: true,
          minify: {
            sort: true,
          },
        }))
      .pipe(rename('polymer-expressions.min.js')))
    .pipe(gulp.dest('.'));
});

gulp.task('build', ['build-npm', 'build-bower']);

gulp.task('clean', (done) => {
  fs.removeSync(path.join(__dirname, 'lib'));
  fs.removeSync(path.join(__dirname, 'polymer-expressions.js'));
  fs.removeSync(path.join(__dirname, 'polymer-expressions.min.js'));
  fs.removeSync(path.join(__dirname, 'polymer-expressions.d.ts'));
});

gulp.task('build-all', (done) => {
  runSeq('clean', 'init', 'lint', 'build', done);
});

gulp.task('test', ['build-npm'], () =>
  gulp.src('test/**/*_test.js', {read: false})
      .pipe(mocha({
        ui: 'tdd',
        reporter: 'spec',
      }))
);

gulp.task('tslint', () =>
  gulp.src('src/**/*.ts')
    .pipe(tslint({
      configuration: 'tslint.json',
    }))
    .pipe(tslint.report('verbose')));

gulp.task('eslint', () =>
  gulp.src('test/**/*.js')
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError()));

gulp.task('depcheck', () => new Promise((resolve, reject) => {
  depcheck(__dirname, {ignoreDirs: []}, (result) => {
    let invalidFiles = Object.keys(result.invalidFiles) || [];
    let invalidJsFiles = invalidFiles.filter((f) => f.endsWith('.js'));
    if (invalidJsFiles.length > 0) {
      console.log('Invalid files:', result.invalidFiles);
      reject(new Error('Invalid files'));
      return;
    }

    if (result.dependencies.length) {
      console.log('Unused dependencies:', unused.dependencies);
      reject(new Error('Unused dependencies'));
      return;
    }

    resolve();
  });
}));

/**
 * Forks a stream of Vinyl files, cloning each file before emitting on the fork.
 */
class ForkedVinylStream extends stream.Readable {

  constructor(input) {
    super({objectMode: true});
    this.input = input;
    input.on('data', (file) => {
      this.push(file.clone({deep: true, contents: true}));
    });
    input.on('end', () => {
      this.push(null);
    });
    input.on('error', (e) => {
      this.emit('error', e);
    });
  }

  _read(size) {
    // apparently no-op is fine, but this method is required,
    // see: https://nodejs.org/api/stream.html#stream_readable_read_size_1
  }
}
