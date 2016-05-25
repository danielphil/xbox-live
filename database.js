var sqlite3 = require('sqlite3').verbose();
var fs = require('fs');

var gameDataJSON = fs.readFileSync('casperjs/gamelist.json');
var gameData = JSON.parse(gameDataJSON);

var db = new sqlite3.Database('xbox_live.db');

function populateGameTable() {
    db.serialize(function () {
        db.run("CREATE TABLE IF NOT EXISTS games(\
            id INTEGER PRIMARY KEY AUTOINCREMENT,\
            name TEXT,\
            url TEXT,\
            available INTEGER,\
            UNIQUE(url)\
        )");
        
        db.run("UPDATE games SET available = 0");
        
        var gameInsert = db.prepare("\
            INSERT INTO games (name, url, available) SELECT ?, ?, 1\
            WHERE NOT EXISTS(SELECT 1 FROM games WHERE url = ?2)\
        ");
        var gameUpdateAvailable = db.prepare("UPDATE games SET available = 1 WHERE url = ?");
        
        gameData.forEach(function (game) {
            gameInsert.run(game.name, game.url);
            gameUpdateAvailable.run(game.url);
        });
        gameUpdateAvailable.finalize();
        gameInsert.finalize();
    });
}

function createUrlList() {
    db.serialize(function () {
        db.each("SELECT id, url FROM games WHERE available = 1", function (err, row) {
            console.log(row.id + ": " + row.url);
        });
    });
}

populateGameTable();
createUrlList();

db.close();