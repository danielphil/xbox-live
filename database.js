var sqlite3 = require('sqlite3').verbose();
var fs = require('fs');
var child_process = require('child_process');

var db = new sqlite3.Database('xbox_live.db');

function createTables(onError, onComplete) {
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
    
    onComplete();
}

function doesGameListNeedUpdate(onComplete) {  
    db.serialize(function () {
        db.all("SELECT date from timestamps WHERE name = 'gameList'", function (err, rows) {
            var timestamp = null;
            
            if (rows.length === 1) {
                timestamp = new Date(rows[0].date);
            }
            
            if (!timestamp) {
                onComplete(true);
            }
            var elapsedMs = Date.now() - timestamp;
    
            var elapsedHours = elapsedMs / 1000 / 60 / 60;
            onComplete(elapsedHours > 24);
        });      
    });
}

function updateTimestamp() {
    db.serialize(function () {
        db.run("INSERT INTO timestamps (name, date) SELECT 'gameList', '' WHERE NOT EXISTS(SELECT 1 from timestamps WHERE name = 'gameList')");
        db.run("UPDATE timestamps SET date = '" + new Date().toISOString() + "' WHERE name = 'gameList'");
    });
}

function populateGameTable(onError, onComplete) {
    doesGameListNeedUpdate(function (needsUpdate) {
        if (needsUpdate) {
            child_process.execFileSync('../node_modules/casperjs/bin/casperjs', ['gamelist.js'], { cwd: 'casperjs', stdio: 'inherit' });
            
            var gameDataJSON = fs.readFileSync('casperjs/gamelist.json');
            var gameData = JSON.parse(gameDataJSON);
            
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
        onComplete();
    });
}

function getPriceForGame(id, url) {
    try {
        child_process.execFileSync('../node_modules/casperjs/bin/casperjs', ['gameinfo.js', url], { cwd: 'casperjs', stdio: 'inherit' });
    } catch (e) {
        console.log("Failed to get price for URL: " + url);
        return;
    }

    var gameInfoJSON = fs.readFileSync('casperjs/gameinfo.json');
    var gameInfo = JSON.parse(gameInfoJSON);
            
    db.serialize(function () {
        var date = new Date().toISOString();
        db.run("INSERT INTO prices (gameId, price, date) SELECT ?, ?, ?", id, gameInfo.price, date);
        db.run("UPDATE games SET lastUpdate = ? WHERE id = ?", date, id);
    });
}

function createUrlList(onError, onComplete) {
    db.serialize(function () {
        db.each(
            "SELECT id, url FROM games\
            WHERE available = 1 AND (lastUpdate IS NULL OR julianday('now') - julianday(lastUpdate) >= 1)\
            ORDER BY datetime(lastUpdate) ASC\
            LIMIT 50"
        , function (err, row) {
            getPriceForGame(row.id, row.url);
        }, onComplete);
    });    
}

function run(taskList, cleanup) {
    if (taskList.length === 0) {
        cleanup();
        return;
    }
    
    var task = taskList.shift();
    var onError = function (error) {
        console.log(error);
        cleanup();
    };
    
    var onComplete = function () {
        run(taskList, cleanup);
    }
    task(onError, onComplete);
}

var tasks = [
    createTables,
    populateGameTable,
    createUrlList    
];

run(tasks, function () { db.close(); });
