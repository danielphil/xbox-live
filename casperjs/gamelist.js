var casper = require('casper').create({ verbose: true, logLevel: 'info' });
var fs = require('fs');
var utils = require('utils');
var result = [];
var listUrl = 'http://store.xbox.com/en-GB/Xbox-One?page='; 
casper.start(listUrl + '1');

casper.then(function () {
    var pageCount = casper.evaluate(function () {
        return $('.currentPage').get(0).innerText.match(/.*\s(\d+)/)[1];
    });
    casper.log('Found ' + pageCount + ' pages', 'info');
    
    if (!pageCount) {
        casper.die('Unable to obtain page count!', 1);
    }
    
    if (pageCount > 50) {
        casper.die('Page count seems unusually big!', 2);
    }
    
    for (var i = 1; i <= pageCount; i++) {
        (function () {
            var theUrl = listUrl + i;
            casper.thenOpen(theUrl, function () {
                casper.log('Opening ' + theUrl + '...', 'info');
                //casper.capture("output.png");
                var pageItems = casper.evaluate(function () {
                    return $(".gameTile .gameTitle a").map(function(i, el) { return { name: el.innerText, url: el.href}; }).get();
                });
                result = result.concat(pageItems);
            });
        })();
    }
});

casper.on('http.status.404', function (resource) {
    casper.die('404 trying to access: ' + resource.url, 3);
});

casper.run(function () {
    fs.write("gamelist.json", utils.serialize(result), 'w');
    //utils.dump(result);
    casper.done();
});