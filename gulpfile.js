'use strict';

var browserify = require('browserify');
var browserSync = require('browser-sync');
var duration = require('gulp-duration');
var gulp = require('gulp');
var gutil = require('gulp-util');
var jade = require('gulp-jade');
var notifier = require('node-notifier');
var path = require('path');
var prefix = require('gulp-autoprefixer');
var rimraf = require('rimraf');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var streamify = require('gulp-streamify');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var watchify = require('watchify');
var ghPages = require('gulp-gh-pages');
var runSequence = require('run-sequence');

var production = process.env.NODE_ENV === 'production';

var config = {
  base: {
    dev: '/',
    production: '/static-boilerplate/'
  },
  destination: './public',
  scripts: {
    source: './src/js/main.js',
    destination: './public/js/',
    filename: 'bundle.js'
  },
  templates: {
    source: './src/jade/**/*.jade',
    watch: './src/jade/**/*.jade',
    destination: './public/'
  },
  styles: {
    source: './src/sass/style.scss',
    watch: './src/sass/*.scss',
    destination: './public/css/'
  },
  assets: {
    source: './src/assets/**/*.*',
    watch: './src/assets/**/*.*',
    destination: './public/'
  }
};

var browserifyConfig = {
  entries: [config.scripts.source],
  extensions: config.scripts.extensions,
  debug: !production,
  cache: {},
  packageCache: {}
};

function handleError(err) {
  gutil.log(err);
  gutil.beep();
  notifier.notify({
    title: 'Compile Error',
    message: err.message
  });
  return this.emit('end');
}

gulp.task('scripts', function () {
  var pipeline = browserify(browserifyConfig)
    .bundle()
    .on('error', handleError)
    .pipe(source(config.scripts.filename));

  if (production) {
    pipeline = pipeline.pipe(streamify(uglify()));
  }

  return pipeline.pipe(gulp.dest(config.scripts.destination));
});

gulp.task('templates', function () {
  var base = (production ? config.base.production : config.base.dev);
  var pipeline = gulp.src(config.templates.source)
    .pipe(jade({
      pretty: !production,
      locals: {
        base: base
      }
    }))
    .on('error', handleError)
    .pipe(gulp.dest(config.templates.destination));

  if (production) {
    return pipeline;
  }

  return pipeline.pipe(browserSync.reload({
    stream: true
  }));
});

gulp.task('styles', function () {
  var pipeline = gulp.src(config.styles.source);

  if (!production) {
    pipeline = pipeline.pipe(sourcemaps.init());
  }

  pipeline = pipeline.pipe(sass({
      includePaths: ['./node_modules/bootstrap-sass/assets/stylesheets']
    }))
    .on('error', handleError)
    .pipe(prefix('last 2 versions', 'Chrome 34', 'Firefox 28', 'iOS 7'));

  if (!production) {
    pipeline = pipeline.pipe(sourcemaps.write('.'));
  }

  pipeline = pipeline.pipe(gulp.dest(config.styles.destination));

  if (production) {
    return pipeline;
  }

  return pipeline.pipe(browserSync.stream({
    match: '**/*.css'
  }));
});

gulp.task('assets', function () {
  return gulp.src(config.assets.source)
    .pipe(gulp.dest(config.assets.destination));
});

gulp.task('server', function () {
  return browserSync({
    open: false,
    port: 9001,
    server: {
      baseDir: config.destination
    }
  });
});

gulp.task('watch', function () {
  gulp.watch(config.templates.watch, ['templates']);
  gulp.watch(config.styles.watch, ['styles']);
  gulp.watch(config.assets.watch, ['assets']);

  var bundle = watchify(browserify(browserifyConfig));

  bundle.on('update', function () {
    var build = bundle.bundle()
      .on('error', handleError)
      .pipe(source(config.scripts.filename));

    build.pipe(gulp.dest(config.scripts.destination))
      .pipe(duration('Rebundling browserify bundle'))
      .pipe(browserSync.reload({
        stream: true
      }));
  }).emit('update');
});

var buildTasks = ['templates', 'styles', 'scripts', 'assets'];

gulp.task('build', function () {
  rimraf.sync(config.destination);
  return gulp.start(buildTasks);
});

gulp.task('push', function () {
  return gulp.src(config.destination + '/**/*')
    .pipe(ghPages());
});

gulp.task('deploy', function () {
  production = true;
  rimraf.sync(config.destination);
  runSequence(['templates', 'styles', 'scripts', 'assets'], 'push');
});

gulp.task('default', buildTasks.concat(['watch', 'server']));
