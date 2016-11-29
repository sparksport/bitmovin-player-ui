/*
 *  Copyright (C) 2016, bitmovin GmbH, All Rights Reserved
 *
 * Authors: Mario Guggenberger <mario.guggenberger@bitmovin.com>
 *
 * This source code and its use and distribution, is subject to the terms
 * and conditions of the applicable license agreement.
 */

var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var tsify = require('tsify');
var watchify = require('watchify');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync');
var cssBase64 = require('gulp-css-base64');
var postcss = require('gulp-postcss');
var postcssSVG = require('postcss-svg');
var autoprefixer = require('autoprefixer');
var cssnano = require('cssnano');
var uglify = require('gulp-uglify');
var gif = require('gulp-if');
var buffer = require('vinyl-buffer');
var rename = require('gulp-rename');

var paths = {
    source: {
        html: ['./src/html/*.html'],
        ts: ['./src/ts/main.ts'],
        tsWatch: ['./src/ts/**/*.ts'],
        sass: ['./src/scss/**/*.scss']
    },
    target: {
        html: './dist',
        js: './dist/js',
        css: './dist/css'
    }
};

var browserifyInstance = browserify({
    basedir: '.',
    debug: true,
    entries: paths.source.ts,
    cache: {},
    packageCache: {}
}).plugin(tsify);

var catchBrowserifyErrors = false;
var production = false;

// Deletes the target directory containing all generated files
gulp.task('clean', del.bind(null, [paths.target.html]));

// Copies html files to the target directory
gulp.task('html', function () {
    return gulp.src(paths.source.html)
        .pipe(gulp.dest(paths.target.html));
});

// Compiles JS and TypeScript to JS in the target directory
gulp.task('browserify', function () {
    var browserifyBundle = browserifyInstance.bundle();

    if(catchBrowserifyErrors) {
        // Normally an error breaks a running task. For permanent tasks like watch/serve, we want the task to
        // stay alive and ignore errors, so we catch them here and print them to the console.
        browserifyBundle.on('error', console.error.bind(console));
    }

    // Compile output JS file
    var stream = browserifyBundle
        .pipe(source('bitmovin-playerui.js'))
        .pipe(buffer())
        .pipe(gulp.dest(paths.target.js));

    if (production) {
        // Minify JS
        stream.pipe(uglify())
            .pipe(rename({extname: '.min.js'}))
            .pipe(gulp.dest(paths.target.js));
    }

    stream.pipe(browserSync.reload({stream: true}));
});

// Compiles SASS stylesheets to CSS stylesheets in the target directory, adds autoprefixes and creates sourcemaps
gulp.task('sass', function () {
    var stream = gulp.src(paths.source.sass)
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(postcss([
            autoprefixer({browsers: ['> 1%', 'last 2 versions', 'Firefox ESR']}),
            postcssSVG()
        ]))
        .pipe(cssBase64())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(paths.target.css));

    if (production) {
        // Minify CSS
        stream.pipe(postcss([cssnano()]))
            .pipe(rename({extname: '.min.css'}))
            .pipe(gulp.dest(paths.target.css));
    }

    stream.pipe(browserSync.reload({stream: true}));
});

// Builds the complete project from the sources into the target directory
gulp.task('build', function(callback) {
    // First run 'clean', then the other tasks
    // TODO remove runSequence on Gulp 4.0 and use built in serial execution instead
    runSequence('clean',
        ['html', 'browserify', 'sass'],
        callback);
});

gulp.task('build-prod', function(callback) {
    production = true;
    runSequence('build', callback);
});

gulp.task('default', ['build']);

// Watches files for changes and runs their build tasks
gulp.task('watch', function () {
    // Watch for changed html files
    gulp.watch(paths.source.html, ['html']);

    // Watch SASS files
    gulp.watch(paths.source.sass, ['sass']);

    // Watch files for changes through Browserify with Watchify
    catchBrowserifyErrors = true;
    return browserifyInstance
        .plugin(watchify)
        // When a file has changed, rerun the browserify task to create an updated bundle
        .on('update', function () {
            gulp.start('browserify');
        })
        .bundle();
});

// Serves the project in the browser and updates it automatically on changes
gulp.task('serve', function () {
    runSequence(['build'], function () {
        browserSync({
            notify: false,
            port: 9000,
            server: {
                baseDir: [paths.target.html]
            }
        });

        gulp.watch(paths.source.sass, ['sass']);
        gulp.watch(paths.source.html, ['html']).on('change', browserSync.reload);
        catchBrowserifyErrors = true;
        gulp.watch(paths.source.tsWatch, ['browserify']);
    });
});