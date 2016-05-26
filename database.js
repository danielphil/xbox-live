var sqlite3 = require('sqlite3').verbose();
var fs = require('fs');
var child_process = require('child_process');

var gameDataJSON = fs.readFileSync('casperjs/gamelist.json');
var gameData = JSON.parse(gameDataJSON);

var db = new sqlite3.Database('xbox_live.db');

function createTables() {
    db.serialize(function () {
        db.run("CREATE TABLE IF NOT EXISTS games(\
            id INTEGER PRIMARY KEY AUTOINCREMENT,\
            name TEXT,\
            url TEXT,\
            available INTEGER,\
            lastUpdate TEXT,\
            UNIQUE(url)\
        )");
        
        db.run("CREATE TABLE IF NOT EXISTS prices(\
            gameId INTEGER,\
            price TEXT,\
            date TEXT\
        )");
        
        db.run("CREATE TABLE IF NOT EXISTS timestamps(\
            name TEXT,\
            date TEXT\
        )");
    });
}

function doesGameListNeedUpdate() {
    var timestamp = null;
    
    db.serialize(function () {
        db.all("SELECT date from timestamps WHERE name = 'gameList'", function (err, rows) {
            if (rows.length === 1) {
                timestamp = new Date(rows[0].date);
            }
        });      
    });
    
    if (!timestamp) {
        return true;
    }
    
    var elapsedMs = Date.now() - timestamp;
    
    var elapsedHours = elapsedMs / 1000 / 60 / 60;
    console.log(elapsedHours);
    return elapsedHours > 24;
}

function updateTimestamp() {
    db.serialize(function () {
        db.run("INSERT INTO timestamps (name, date) SELECT 'gameList', '' WHERE NOT EXISTS(SELECT 1 from timestamps WHERE name = 'gameList')");
        db.run("UPDATE timestamps SET date = '" + new Date().toISOString() + "' WHERE name = 'gameList'");
    });
}

function populateGameTable() {
    if (!doesGameListNeedUpdate()) {
        return;
    }
    
    db.serialize(function () {      
        db.run("UPDATE games SET available = 0");
        
        var gameInsert = db.prepare("\
            INSERT INTO games (name, url, available, lastUpdate) SELECT ?, ?, 1, NULL\
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
    
    updateTimestamp();
}

function createUrlList() {
    var toUpdate = [];
    
    db.serialize(function () {
        db.all(
            "SELECT id, url FROM games\
            WHERE available = 1 AND (lastUpdate IS NULL OR julianday('now') - julianday(lastUpdate) >= 1)\
            ORDER BY datetime(lastUpdate) ASC\
            LIMIT 10"
        , function (err, rows) {
            console.log('got here');
            toUpdate = rows;
        });
    });
    
    console.log(toUpdate);
    toUpdate.forEach(function (row) {
        child_process.execFileSync('../node_modules/casperjs/bin/casperjs', ['gameinfo.js', row.url], { cwd: 'casperjs', stdio: 'inherit' });
    });
}

createTables();
populateGameTable();
createUrlList();

//child_process.execFileSync('../node_modules/casperjs/bin/casperjs', ['gamelist.js'], { cwd: 'casperjs', stdio: 'inherit' });

db.close();