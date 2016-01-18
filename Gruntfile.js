module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    //css minifier, not configured to combine files, change if needed https://github.com/gruntjs/grunt-contrib-cssmin
    cssmin: {
      target: {
        files: [{
          expand: true,
          src: ['css/*.css'],
          dest: 'release',
          ext: '.min.css'
        }]
      }
    },
    //JS minifier  (https://github.com/gruntjs/grunt-contrib-uglify)
    uglify: {
      target: {
        files: {
          'release/js/app.min.js': ['js/app.js'],
        }
      }
    },

    jsbeautifier: {
    	files: ['js/app.js'],
    	options: {
    	}
    },
  });

grunt.loadNpmTasks('grunt-jsbeautifier');
grunt.loadNpmTasks('grunt-contrib-uglify');
grunt.loadNpmTasks('grunt-contrib-cssmin');

grunt.registerTask('default', ['jsbeautifier', 'uglify', 'cssmin']);

};
