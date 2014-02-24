#!/usr/bin/env node
'use strict';

var _ = require('lodash');
var Q = require('q');
var fs = require('fs');
var request = require('request');
var nopt = require('nopt');
var chalk = require('chalk');
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
    _.each(backgrounds, function(backgroundEntry) {
        backgroundEntry.url = backgroundEntry.url.replace(sizeRegex, '/'+sizeString+'/');
    });
};

var downloadImages = function(backgrounds, directory) {
    var promises = [];
    console.log(backgrounds);
    fs.existsSync(directory) || fs.mkdirSync(directory);
    _.each(backgrounds, function(backgroundEntry) {
        var deferred = Q.defer();
        promises.push(deferred.promise);
        var filename = directory + '/' + decodeURIComponent(backgroundEntry.url.split('/').pop());
        request(backgroundEntry.url)
            .pipe(fs.createWriteStream(filename))
            .on('close', function() {
                console.log(chalk.grey(filename));
                deferred.resolve();
            });
    });
    return Q.all(promises);
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
    console.log(chalk.yellow('chromecast-backgrounds --download=<directory> --size=<size> --save=<file> --writemd=<file>'));
    return;
}

console.log(chalk.underline('Parsing Chromecast Home...\n'));

getChromecastBackgrounds().then(function(backgrounds) {
    if (options.size) {
        console.log(chalk.underline('Updating sizes to', options.size));
        updateSize(options.size, backgrounds);
    }
    if (options.load) {
        console.log(chalk.underline('Loading previous backgrounds from', options.load));
        var backgroundsFromJSON;
        read(options.load, 'utf8').then(function(backgroundsJSON) {
            backgroundsFromJSON = JSON.parse(backgroundsJSON);
            backgrounds = _.uniq(_.union(backgrounds, backgroundsFromJSON), 'url');
        });
    }
    if (options.save) {
        console.log(chalk.underline('Writing backgrounds JSON to', options.save));
        saveObjectToFile(options.save, backgrounds);
    }
    if (options.writemd) {
        console.log(chalk.underline('Writing backgrounds as inline markdown to', options.writemd));
        writeInlineMarkdown(options.writemd, backgrounds);
    }
    if (options.verbose) {
        console.log(chalk.grey(JSON.stringify(backgrounds)));
    }
    if (options.download) {
        console.log(chalk.underline('Downloading background images...\n'));
        downloadImages(backgrounds, options.download).done(function() {
            console.log(chalk.green('\n✓ Done!'));
        });
    } else {
        console.log(chalk.green('\n✓ Done!'));
    }
});
