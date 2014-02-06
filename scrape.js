#!/usr/bin/env node

var fs = require('fs');
var request = require('request');
var _ = require('lodash');

var chromecastHomeURL = "https://clients3.google.com/cast/chromecast/home/v/c9541b08";
var initJSONStateRegex = /(JSON\.parse\(.+'\))/;
var backgroundsJSONFile = "backgrounds.json";

var parseChromecastHome = function(htmlString) {

  var JSONParse = htmlString.match(initJSONStateRegex)[1];
  var initState = eval(JSONParse); // I don't know why this is ok but JSON.parse fails.

  var parsedBackgrounds = [];
  for (var i in initState[1]) {
    var backgroundEntry = {
      url: initState[1][i][1],
      author: initState[1][i][2]
    };
    parsedBackgrounds.push(backgroundEntry);
  }
  return parsedBackgrounds;
};

var updateSize = function(sizeString, backgrounds) {
  var sizeRegex = /\/s\d+.*?\//;
  _(backgrounds).each(function(backgroundEntry) {
    backgroundEntry.url = backgroundEntry.url.replace(sizeRegex, "/"+sizeString+"/");
  });
};

var saveToFile = function(filename, content) {
  var jsonString = JSON.stringify(content);
  fs.writeFile(filename, jsonString, function(err, data) {
    if (err) {
      return console.log(err);
    }
    if (data) {
      console.log(data);
    }
  });
};

var getFilenames = function(backgrounds) {
  _.each(_.pluck(backgrounds, 'url'), function(url) {
    return _.last(url.split('/'));
  });
};

var diffBackgrounds = function(A, B) {
  return _.difference(getFilenames(A), getFilenames(B));
};

var scrapeChromecastBackgrounds = function() {
  var backgrounds = fs.readFile(backgroundsJSONFile);

  request(chromecastHomeURL, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var parsedBackgrounds = parseChromecastHome(body);
      if (diffBackgrounds(backgrounds, parsedBackgrounds)) {
        console.log("No new backgrounds.");
        return;
      }
      backgrounds = _.union(parsedBackgrounds);
      updateSize('s2560', backgrounds);
      console.log("Writing: ", backgrounds);
      saveToFile(backgroundsJSONFile, backgrounds);
    }
  });
};

scrapeChromecastBackgrounds();
