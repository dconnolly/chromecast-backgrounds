#!/usr/bin/env node
'use strict';

var _ = require('lodash');
var Q = require('q');
var fs = require('fs');
var request = require('request');
var nopt = require('nopt');
var chalk = require('chalk');
var getChromecastBackgrounds = require('./index');

var read = fs.readFileSync;
var write = fs.writeFileSync;

var getNameFromURL = function(url) {
    return decodeURIComponent(url.split('/').pop());
};

var saveObjectToFile = function(filename, content) {
    var jsonString = JSON.stringify(content, null, 4);
    write(filename, jsonString);
};

var writeInlineMarkdown = function(filename, backgrounds) {
    var content = '';
    _(backgrounds).each(function(backgroundEntry) {
        content += '![]('+backgroundEntry.url+')\n';
    });
    write(filename, content);
};

var updateDimensions = function(size, width, height, backgrounds) {
    var regex = /(?=[^/]*s\d+)(?=[^/]*w\d+)(?=[^/]*c)(?=[^/]*h\d+)[^/]+\//
    var outputString = '';

    // We give priority to the size argument over the width and height arguments
    if (size) {
        outputString = 's' + size + '/';
    }
    else if (width && height) {
        outputString = 'w' + width + '-c-h' + height + '/';
    }
    _.each(backgrounds, function(backgroundEntry) {
        backgroundEntry.url = backgroundEntry.url.replace(regex, outputString);
    });
};

var downloadImages = function(backgrounds, directory) {
    var promises = [];
    fs.existsSync(directory) || fs.mkdirSync(directory);
    _.each(backgrounds, function(backgroundEntry) {
        var deferred = Q.defer();
        promises.push(deferred.promise);
        var filename = directory + '/' + getNameFromURL(backgroundEntry.url);
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
    download: String,
    height: String,
    help: Boolean,
    load: String,
    save: String,
    size: String,
    verbose: Boolean,
    width: String,
    writemd: String
}, {
    h: '--help',
    v: '--verbose'
});

if (options.help) {
    var helpString = 'chromecast-backgrounds \
    --download=<directory> \
    --height=<height_pixels> \
    --save=<file> \
    --size=<maximum_size_pixels> \
    --width=<width_pixels> \
    --writemd=<file>';
    console.log(chalk.yellow(helpString));
    return;
}

console.log(chalk.underline('Parsing Chromecast Home...\n'));

getChromecastBackgrounds().then(function(backgrounds) {
    if (options.size || options.width && options.height) {
        console.log(chalk.underline('Calling: updateDimensions(%d,%d,%d)'),
                   options.size, options.width, options.height);
        updateDimensions(
          options.size, options.width, options.height, backgrounds);
    }

    if (options.load) {
        console.log(chalk.underline('Loading previous backgrounds from', options.load));
        var backgroundsFromJSON = JSON.parse(read(options.load, 'utf8'));
        backgrounds = _.uniq(_.union(backgrounds, backgroundsFromJSON), function(backgroundEntry) {
            return getNameFromURL(backgroundEntry.url);
        });
        var newCount = backgrounds.length - backgroundsFromJSON.length;
        if (newCount > 0) {
            console.log(chalk.green(String(newCount) + ' new backgrounds!'));
        }
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
        console.log(chalk.grey(JSON.stringify(backgrounds, null, 4)));
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
