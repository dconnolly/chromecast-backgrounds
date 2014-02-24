#!/usr/bin/env node
'use strict';

var _ = require('lodash');
var Q = require('q');
var fs = require('fs');
var request = require('request');
var nopt = require('nopt');
var getChromecastBackgrounds = require('./index');

var read = Q.denodeify(fs.readFile);
var write = Q.denodeify(fs.writeFile);

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
        content += '![]('+backgroundEntry.url+')\n';
    });
    write(filename, content);
};

var updateSize = function(sizeString, backgrounds) {
    var sizeRegex = /\/s\d+.*?\//;
    _(backgrounds).each(function(backgroundEntry) {
        backgroundEntry.url = backgroundEntry.url.replace(sizeRegex, '/'+sizeString+'/');
    });
};

var downloadImages = function(backgrounds, directory) {
    var promises = [];
    fs.existsSync(directory) || fs.mkdirSync(directory);
    _.each(backgrounds, function(backgroundEntry) {
        var deferred = Q.defer();
        promises.push(deferred.promise);
        var filename = directory + '/' + decodeURIComponent(backgroundEntry.url.split('/').pop());
        request(backgroundEntry.url)
            .pipe(fs.createWriteStream(filename))
            .on('close', function() {
                console.log(filename);
                deferred.resolve();
            });
    });
    Q.all(promises).done(function() {
        console.log('All done!');
    });
};

var options = nopt({
    size: String,
    load: String,
    save: String,
    writemd: String,
    download: String,
    help: Boolean,
    verbose: Boolean
}, {
    h: '--help',
    v: '--verbose'
});

if (options.help) {
    console.log('chromecast-backgrounds --download=<directory> --size=<size> --save=<file> --writemd=<file>');
    return;
}

getChromecastBackgrounds().then(function(backgrounds) {
    if (options.size) {
        console.log('Updating sizes to ', options.size);
        backgrounds = updateSize(options.size, backgrounds);
    }
    if (options.load) {
        console.log('Loading previous backgrounds from ', options.load);
        var backgroundsFromJSON;
        read(options.load, 'utf8').then(function(backgroundsJSON) {
            backgroundsFromJSON = JSON.parse(backgroundsJSON);
            backgrounds = _.uniq(_.union(backgrounds, backgroundsFromJSON), 'url');
        });
    }
    if (options.save) {
        console.log('Writing backgrounds JSON to ', options.save);
        saveObjectToFile(options.save, backgrounds);
    }
    if (options.writemd) {
        console.log('Writing backgrounds as inline markdown to ', options.writemd);
        writeInlineMarkdown(options.writemd, backgrounds);
    }
    if (options.download) {
        downloadImages(backgrounds, options.download);
    }
    if (options.verbose) {
        console.log(backgrounds);
    }
});
