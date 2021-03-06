/*

browser_launcher.js
===================

This file more or less figures out how to launch any browser on any platform.

*/

var path = require('path')
var rimraf = require('rimraf')
var async = require('async')
var fs = require('fs')
var temp = require('temp')
var fileutils = require('./fileutils')
var browserExeExists = fileutils.browserExeExists
var findableByWhich = fileutils.findableByWhich
var findableByWhere = fileutils.findableByWhere

// Find the temporary directory for the system
var tempDir = function(){
  return {
    chrome: temp.path({prefix: 'testem.chrome'}),
    chrome_canary: temp.path({prefix: 'testem.chrome-canary'}),
    chromium: temp.path({prefix: 'testem.chromium'}),
    firefox: temp.path({prefix: 'testem.firefox'}),
    opera: temp.path({prefix: 'testem.opera'}),
    safari: temp.path({prefix: 'testem.safari'})
  };
}()

var userHomeDir = process.env.HOME || process.env.USERPROFILE

function removeTestemFilesFromTemporaryDirectory(){
  var filesInTmp = fs.readdirSync(temp.dir)
  var testemDirectories = filesInTmp.filter(function(file) {
    if (file.indexOf('testem') === 0 && fs.lstatSync(temp.dir, file).isDirectory()) {
      return true
    }
    return false
  })
  testemDirectories = testemDirectories.map(function(directory){
    return path.join(temp.dir, directory)
  })
  testemDirectories.forEach(function(directory){
    rimraf.sync(directory)
  })
}

function setupFirefoxProfile(profileDir, done){
  rimraf(profileDir, function(){
    // using prefs.js to suppress the check default browser popup
    // and the welcome start page
    var prefs = [
      'user_pref("browser.shell.checkDefaultBrowser", false);'
      , 'user_pref("browser.cache.disk.smart_size.first_run", false);'
    ]
    fs.mkdir(profileDir, function(){
      fs.writeFile(profileDir + '/prefs.js', prefs.join('\n'), function(){
        done()
      })
    })
  })
}


// Return the catalogue of the browsers that Testem supports for the platform. Each "browser object"
// will contain these fields:
//
// * `name` - the display name of the browser
// * `exe` - path to the executable to use to launch the browser
// * `setup(app, done)` - any initial setup needed before launching the executable(this is async, 
//        the second parameter `done()` must be invoked when done).
// * `supported(cb)` - an async function which tells us whether the browser is supported by the current machine.
function browsersForPlatform(){
  var platform = process.platform
  if (platform === 'win32'){
    return  [
      {
        name: "IE",
        exe: "C:\\Program Files\\Internet Explorer\\iexplore.exe",
        supported: browserExeExists
      },
      {
        name: "Firefox",
        exe: [
          "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
          "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe"
        ],
        args: ["-profile", tempDir.firefox],
        setup: function(config, done){
          setupFirefoxProfile(tempDir.firefox, done)
        },
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: browserExeExists
      },
      {
        name: "Chrome",
        exe: [
          userHomeDir + "\\Local Settings\\Application Data\\Google\\Chrome\\Application\\chrome.exe",
          userHomeDir + "\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files\\Google\\Chrome\\Application\\Chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\Chrome.exe"
        ],
        args: ["--user-data-dir=" + tempDir.chrome, "--no-default-browser-check", "--no-first-run"],
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: browserExeExists
      },
      {
        name: "Safari",
        exe: [
          "C:\\Program Files\\Safari\\safari.exe",
          "C:\\Program Files (x86)\\Safari\\safari.exe"
        ],
        supported: browserExeExists
      },
      {
        name: "Opera",
        exe: [
          "C:\\Program Files\\Opera\\opera.exe",
          "C:\\Program Files (x86)\\Opera\\opera.exe"
        ],
        args: ["-pd", tempDir.opera],
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: browserExeExists
      },
      {
        name: 'PhantomJS',
        exe: 'phantomjs',
        args: function(config){
          return [path.dirname(__dirname) + '/assets/phantom.js', this.getUrl()]
        },
        supported: findableByWhere
      }
    ]
  }else if (platform === 'darwin'){
    return [
      {
        name: "Chrome", 
        exe: "/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome", 
        args: ["--user-data-dir=" + tempDir.chrome, "--no-default-browser-check", "--no-first-run"],
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: browserExeExists
      },
      {
        name: "Chrome Canary", 
        exe: "/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary", 
        args: ["--user-data-dir=" + tempDir.chrome_canary, "--no-default-browser-check", "--no-first-run"],
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: browserExeExists
      },
      {
        name: "Firefox", 
        exe: "/Applications/Firefox.app/Contents/MacOS/firefox",
        args: ["-profile", tempDir.firefox],
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: browserExeExists
      },
      {
        name: "Safari",
        exe: "/Applications/Safari.app/Contents/MacOS/Safari",
        setup: function(config, done){
          var url = this.getUrl()
          fs.mkdir(tempDir.safari, function() {})
          fs.writeFile(tempDir.safari + '/testem.safari.html', "<script>window.location = '" + url + "'</script>", done)
        },
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        args: function(){
          return [tempDir.safari + '/testem.safari.html']
        },
        supported: browserExeExists
      },
      {
        name: "Opera",
        exe: "/Applications/Opera.app/Contents/MacOS/Opera",
        args: ["-pd", tempDir.opera],
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: browserExeExists
      },
      {
        name: 'PhantomJS',
        exe: 'phantomjs',
        args: function(config){
          return [path.dirname(__dirname) + '/assets/phantom.js', this.getUrl()]
        },
        supported: findableByWhich
      }
    ]
  }else if (platform === 'linux'){
    return [
      {
        name: 'Firefox',
        exe: 'firefox',
        args: ["-no-remote", "-profile", tempDir.firefox],
        setup: function(config, done){
          fs.mkdir(tempDir.firefox, done)
        },
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: findableByWhich
      },
      {
        name: 'Chrome',
        exe: 'google-chrome',
        args: ["--user-data-dir=" + tempDir.chrome,
          "--no-default-browser-check", "--no-first-run"],
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: findableByWhich
      },
      {
        name: 'Chromium',
        exe: ['chromium', 'chromium-browser'],
        args: ["--user-data-dir=" + tempDir.chromium,
          "--no-default-browser-check", "--no-first-run"],
        tearDown: function(){
          removeTestemFilesFromTemporaryDirectory()
        },
        supported: findableByWhich
      },
      {
        name: 'PhantomJS',
        exe: 'phantomjs',
        args: function(config){
          return [path.dirname(__dirname) + '/assets/phantom.js', this.getUrl()]
        },
        supported: findableByWhich
      }
    ]
  }else if (platform === 'sunos') {
	return [
      {
        name: 'PhantomJS',
        exe: 'phantomjs',
        args: function(app){
          return [path.dirname(__dirname) + '/assets/phantom.js', this.getUrl()]
        },
        supported: findableByWhich
      }
	];
  }else{
    return []
  }
}

// Returns the avaliable browsers on the current machine.
function getAvailableBrowsers(cb){
  var browsers = browsersForPlatform()
  browsers.forEach(function(b){
    b.protocol = 'browser'
  })
  async.filter(browsers, function(browser, cb){
    browser.supported(cb)
  }, function(available){
    cb(available)
  })
}

exports.getAvailableBrowsers = getAvailableBrowsers
