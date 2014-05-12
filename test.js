'use strict';

var assert = require('assert');
var _ = require('lodash');
var getChromecastBackgrounds = require('./index');

it('should get some background objects', function(cb) {
    getChromecastBackgrounds().then(function (backgrounds) {
        console.log(backgrounds);
        assert(backgrounds);
        var background = backgrounds[0];
        assert(_.has(background, 'url', 'author'));
        assert(background.url.indexOf('googleusercontent') > 0);
        cb();
    });

});
