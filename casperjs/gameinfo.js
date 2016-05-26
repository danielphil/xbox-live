var casper = require('casper').create({ verbose: true, logLevel: 'info' });
var fs = require('fs');
var utils = require('utils');
var result = {};

var gameUrl = casper.cli.args[0];
if (!gameUrl) {
    casper.die("No game URL provided!", 1);
}

casper.start(gameUrl);

casper.then(function () {
    var price = casper.evaluate(function () {
        return $('#purchaseInfo .price').text();
    });
    casper.log('Price was ' + price, 'info');
    
    price = price || null;
    
    result = { price: price };
});

casper.on('http.status.404', function (resource) {
    casper.die('404 trying to access: ' + resource.url, 3);
});

casper.run(function () {
    fs.write("gameinfo.json", utils.serialize(result), 'w');
    this.exit();
});
