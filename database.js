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
            UNIQUE(url)\
        )");
        
        var gameInsert = db.prepare("\
            INSERT INTO games (name, url) SELECT ?, ?\
            WHERE NOT EXISTS(SELECT 1 FROM games WHERE url = ?2)\
        ");
        gameData.forEach(function (game) {
            gameInsert.run(game.name, game.url);
        });
        gameInsert.finalize();
        /*
        db.each("SELECT rowid AS id, info FROM lorem", function (err, row) {
            console.log(row.id + ": " + row.info);
        });*/
    });
}

db.close();