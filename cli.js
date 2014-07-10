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

var updateDimensions = function(backgrounds, size, width, height, crop) {
    // The regular expression below looks for the presence of each of the
    // following 4 patterns in the string being matched *in any order*:
    // 's\d+', 'w\d+', 'c', 'h\d+'
    // The additional conditions are:
    // 1. Do not match '/' in the prefix for any of the 4 patterns.
    // 2. There should be a '/' after all the 4 patterns have been matched.
    // There's possibly a better regex to do this, but this one also works.
    var regex = /(?=[^/]*s\d+)((?=[^/]*w\d+)(?=[^/]*c)(?=[^/]*h\d+))*[^/]+\//;
    var dimensions = [];

    // We give priority to the size argument over the width and height arguments
    if (size) {
        dimensions.push('s' + size);
    }
    if (width) {
        dimensions.push('w' + width);
    }
    if (height) {
        dimensions.push('h' + height);
    }
    if (crop) {
        dimensions.push('c');
    }
    if (!dimensions.length) {
        return;
    }
    var outputString = dimensions.join('-') + '/';
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
    crop: Boolean,
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
    --size=<maximum_size_pixels> \
    --width=<width_pixels> \
    --height=<height_pixels> \
    --crop \
    --save=<file> \
    --writemd=<file>';
    console.log(chalk.yellow(helpString));
    return;
}

console.log(chalk.underline('Parsing Chromecast Home...\n'));

getChromecastBackgrounds().then(function(backgrounds) {
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
    if (options.size || options.width || options.height) {
        console.log(
            chalk.underline('Updating dimensions (size:%d, width:%d, height:%d)'),
            options.size, options.width, options.height);
        updateDimensions(backgrounds,
                         options.size,
                         options.width,
                         options.height,
                         options.crop);
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
