'use strict';

const babel = require('gulp-babel');
const concat = require('gulp-concat');
const es = require('event-stream');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const uglify = require('gulp-uglify');

const gutil = require('gulp-util');
const through = require('through2');
const applySourceMap = require('vinyl-sourcemaps-apply');
const objectAssign = require('object-assign');
const replaceExt = require('replace-ext');
const babelCore = require('babel-core');

// Custom babel transform so I can custom the moduleId per file. I need a much
// better way to do this, possibly including renaming the modules and files.
const _babel = function (moduleType) {

	return through.obj(function (file, enc, cb) {
		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new gutil.PluginError('gulp-babel', 'Streaming not supported'));
			return;
		}

		try {
			var fileOpts = {
				filename: file.path,
				filenameRelative: file.relative,
				sourceMap: Boolean(file.sourceMap),
				sourceFileName: file.relative,
				sourceMapTarget: file.relative,
        moduleId: 'polymer-expressions/' + file.relative.substring(0, file.relative.length - 3),
        presets: ["es2015"],
        plugins: [`transform-es2015-modules-${moduleType}`],
        moduleIds: true,
			};

			var res = babelCore.transform(file.contents.toString(), fileOpts);

			if (file.sourceMap && res.map) {
				res.map.file = replaceExt(res.map.file, '.js');
				applySourceMap(file, res.map);
			}

			if (!res.ignored) {
				file.contents = new Buffer(res.code);
				file.path = replaceExt(file.path, '.js');
			}

			file.babel = res.metadata;

			this.push(file);
		} catch (err) {
			this.emit('error', new gutil.PluginError('gulp-babel', err, {
				fileName: file.path,
				showProperties: false
			}));
		}

		cb();
	});
};


// const _babel = (moduleType) => babel({
//   presets: ["es2015"],
//   plugins: [`transform-es2015-modules-${moduleType}`],
//   moduleIds: true,
// });

const _build = (dir) => gulp.src(`${dir}/**`)
    .pipe(gulpif(/\.js$/, _babel('commonjs')))
    .pipe(gulp.dest(`build/${dir}`));

const dist = (moduleType) =>
    () => es.merge(jsDist(moduleType), minDist(moduleType))
        .pipe(gulp.dest('.'));

const jsDist = (moduleType) => compileJs(moduleType)
    .pipe(concat('polymer-expressions.js'));

const minDist = (moduleType) => compileJs(moduleType)
    .pipe(concat('polymer-expressions.min.js'))
    .pipe(uglify({
      compress: true,
      minify: {
        sort: true,
      },
    }));

const compileJs = (moduleType) => gulp.src(['src/parser.js', 'src/eval.js'])
    .pipe(_babel(moduleType));

gulp.task('default', ['bower']);

gulp.task('build', () => es.merge(_build('src'), _build('test')));

gulp.task('bower', dist('amd'));

gulp.task('npm', dist('commonjs'));
