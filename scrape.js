#!/usr/bin/env node

var fs = require('fs');
var _ = require('lodash');
var Q = require('q');

var read = Q.denodeify(fs.readFile);
var write = Q.denodeify(fs.writeFile);
var request = Q.denodeify(require('request'));

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

var saveObjectToFile = function(filename, content) {
    var jsonString = JSON.stringify(content);
    write(filename, jsonString, function(err, data) {
        if (err) {
            return console.log(err);
        }
        if (data) {
            console.log(data);
        }
    });
};

var writeInlineMarkdown = function(filename, backgrounds) {
    var content = '';
    _(backgrounds).each(function(backgroundEntry) {
        content += "![]("+backgroundEntry.url+")\n";
    });
    write(filename, content);
};

var scrapeChromecastBackgrounds = function() {
    Q.all([read(backgroundsJSONFile, 'utf8'), request(chromecastHomeURL)])
        .spread(function(backgroundsJSON, requestResult) {
            var backgrounds = JSON.parse(backgroundsJSON);
            var parsed = parseChromecastHome(requestResult[1]);
            parsed = updateSize('s2560', parsed);
            backgrounds = _.uniq(_.union(backgrounds, parsed), 'url');
            console.log("Writing: ", backgrounds);
            saveObjectToFile(backgroundsJSONFile, backgrounds);
            writeInlineMarkdown('README.md', backgrounds);
        });
};

scrapeChromecastBackgrounds();
