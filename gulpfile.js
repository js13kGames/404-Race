// I used the build process from here:
// Original: https://github.com/shreyasminocha/js13k-boilerplate
//

const gulp = require('gulp');

const lintHTML = require('gulp-htmllint');
const lintCSS = require('gulp-stylelint');
const lintJS = require('gulp-eslint');
const deleteFiles = require('gulp-rimraf');
const minifyHTML = require('gulp-minify-html');
const minifyCSS = require('gulp-clean-css');
const minifyJS = require('gulp-terser');
const concat = require('gulp-concat');
const replaceHTML = require('gulp-html-replace');
const imagemin = require('gulp-imagemin');
const zip = require('gulp-zip');
const advzip = require('gulp-advzip');
const checkFileSize = require('gulp-check-filesize');
const inject = require('gulp-inject');

// concat everything in one file, minify, zip and use advzip (to save an extra 1kb over regular zipping)
// https://github.blog/2018-08-09-create-a-13kb-javascript-game-in-30-days-with-js13kgames/

const paths = {
    src: {
        html: "src/index.html",
        css: "src/*.css",
        js: "src/*.js",
        images: "src/*.ico",
    },
    dist: {
        dir: "dist",
        css: "style.min.css",
        js: "script.min.js",
        images: "dist/",
    },
};

gulp.task('lintHTML', () => {
    return gulp.src('src/**.html')
        .pipe(lintHTML());
});

gulp.task('lintCSS', () => {
    return gulp.src(paths.src.css)
        .pipe(lintCSS({
            reporters: [{ formatter: 'string', console: true }]
        }));
});

gulp.task('lintJS', () => {
    return gulp.src(paths.src.js)
        .pipe(lintJS())
        .pipe(lintJS.failAfterError());
});

gulp.task('cleanDist', () => {
    return gulp.src('dist/**/*', { read: false })
        .pipe(deleteFiles());
});

gulp.task('buildHTML', () => {
    return gulp.src(paths.src.html)
        .pipe(replaceHTML({
            css: paths.dist.css,
            js: paths.dist.js
        }))
        .pipe(gulp.dest(paths.dist.dir));
});

gulp.task('mergeIntoHTML', () => {
  return gulp
    .src(`${paths.dist.dir}/index.html`)
    .pipe(inject(gulp.src(`${paths.dist.dir}/${paths.dist.js}`, { read: true }), {
      transform: (filePath, file) =>
        `<script>(function(){${file.contents.toString('utf8')}})();</script>`
    }))
    .pipe(minifyHTML())
    .pipe(gulp.dest(paths.dist.dir));
});

gulp.task('removeDistJS', () => {
    return gulp
        .src(`${paths.dist.dir}/*.js`)
        .pipe(deleteFiles());
});

gulp.task('buildCSS', () => {
    return gulp.src(paths.src.css)
        .pipe(concat(paths.dist.css))
        .pipe(minifyCSS())
        .pipe(gulp.dest(paths.dist.dir));
});

gulp.task('buildJS', () => {
    return (
      gulp
        .src(paths.src.js)
        .pipe(concat(paths.dist.js))
        .pipe(minifyJS())
        .pipe(concat(paths.dist.js))
        .pipe(gulp.dest(paths.dist.dir))
    );
});

gulp.task('optimizeImages', () => {
    return gulp.src(paths.src.images)
        .pipe(imagemin())
        .pipe(gulp.dest(paths.dist.images));
});

gulp.task('zip', () => {
    const thirteenKb = 13 * 1024;

    gulp.src('zip/*')
        .pipe(deleteFiles());

    return gulp.src(`${paths.dist.dir}/**`)
        .pipe(zip('game.zip'))
        .pipe(advzip())
        .pipe(gulp.dest('zip'))
        .pipe(checkFileSize({ fileSizeLimit: thirteenKb }));
});

gulp.task('test', gulp.parallel(
    'lintHTML',
    'lintCSS',
    'lintJS'
));

gulp.task(
  'build',
  gulp.series(
    'cleanDist',
    gulp.parallel('buildCSS', 'buildJS', 'buildHTML', 'optimizeImages'),
    'mergeIntoHTML',
    'removeDistJS',
    'zip'
  )
);

gulp.task('watch', () => {
    gulp.watch(paths.src.html, gulp.series('buildHTML', 'zip'));
    gulp.watch(paths.src.css, gulp.series('buildCSS', 'zip'));
    gulp.watch(paths.src.js, gulp.series('buildJS', 'zip'));
    gulp.watch(paths.src.images, gulp.series('optimizeImages', 'zip'));
});

gulp.task('default', gulp.series(
    'build',
    'watch'
));
