const express = require("express");
const Ably = require("ably");
const p2 = require("p2");

const app = express();
const realtime = new Ably.Realtime("hKZexw.ZiOmBg:iIs357nby6O6pv8mw6YYbZoyrQBiXvR0jUtsJCW1Vbo");

const uniqueId = function (){
    return "id-" + Math.random().toString(36).substring(2, 16);
}

const MIN_PLAYERS_TO_START_GAME = 2;
const GAME_TICKER_MS = 100;

let peopleAccessingTheWebsite = 0;
let alivePlayers = 0;
let totalPlayers = 0;

let players = {};
let playerChannels = {};

let gameTickerOn = false;
let gameRoom;
let deadPlayerCh;
let gameOn;

app.use(express.static("js"));

app.get("/auth", (request, response) => {
   const tokenParams = { clientId: uniqueId() }

   realtime.auth.createTokenRequest(tokenParams, function (err, tokenRequest) {
      if(err){
        response
            .status(500)
            .send("Error requesting token: " + JSON.stringify(err))
      } else {
          response.setHeader("Content-Type", "application/json");
          response.send(JSON.stringify(tokenRequest))
      }
   });
});

app.get("/", (request, response) => {
   response.header("Access-Control-Allow-Origin", "*");
   response.header(
       "Access-Control-Allow-Headers",
       "Origin, X-Requested-With, Content-Type, Accept"
   );
    if(++peopleAccessingTheWebsite > MIN_PLAYERS_TO_START_GAME){
        response.sendFile(__dirname + "views/gameRoomFull.html");
    } else {
        response.sendFile(__dirname + "views/intro.html")
    }
});

app.get("/gameplay", (request, response) =>{
   app.sendFile(__dirname + "views/index.html");
});

app.get("/winner", (request, response) => {
    app.sendFile(__dirname + "views/index.html");
});

app.get("/gameover", (request, response) => {
    app.sendFile(__dirname + "views/index.html");
});

const listener = app.listen(process.env.PORT, () => {
   console.log("Listening on port " + listener.address().port);
});

realtime.connection.once("connected", () => {
   gameRoom = realtime.channels.get("game-room")
   deadPlayerCh = realtime.channels.get("dead-player")

   gameRoom.presence.subscribe("enter", (player) => {
        let newPlayerId;
        let newPlayerData;
        alivePlayers++;
        totalPlayers++;

        if(totalPlayers === 1){
            gameTickerOn = true;
            startGameDataTicker()
        }

        newPlayerId = player.clientId;
        playerChannels[newPlayerId] = realtime.channels.get(
            "clientChannel-" + player.clientId);

        let newPlayerObject = {
            id: newPlayerId,
            x: 20,
            y: 20,
            avatarType: "default",
            score: 0,
            nickname: player.data,
            isAlive: true,
        };

        players[newPlayerId] = newPlayerObject;
        if (totalPlayers == MIN_PLAYERS_TO_START_GAME) {
            startShipAndBullets();
        }
        subscribeToPlayerInput(playerChannels[newPlayerId], newPlayerId);
   });

   gameRoom.presence.subscribe("leave", (player) => {
        let leavingPlayer = player.clientId;
        alivePlayers--;
        totalPlayers--;
        delete players[leavingPlayer];
        if(totalPlayers < MIN_PLAYERS_TO_START_GAME){
            resetServerState();
        }

   });

   deadPlayerCh.subscribe("goal-notif", (msg) => {
        players[msg.data.deadPlayerId].isAlive = false;
        alivePlayers--;
        if(alivePlayers === 0){
            setTimeout(() => {
               finishGame("")
            }, 1000);
        }

   });
});

function startGameDataTicker() {
    let tickInterval = setInterval(() => {
        if(!gameTickerOn){
            clearInterval(tickInterval)
        } else {
            gameRoom.publish("game-state", {
                players: players,
                playerCount: totalPlayers,
                gameOn: gameOn,
            })
        }
    }, GAME_TICKER_MS)
}

function subscribeToPlayerInput(channelInstance, playerId) {
    channelInstance.subscribe("pos", (msg) => {
        player = players[playerId]; // Könnte zu ASYNC Problemen führen...
       if(msg.data.keyPressed === "left"){ // Was passiert wenn ich LEFT und UP gleichzeitig drücke?
           if(player.x - 20 < 20){
               players[playerId].x = 20;
           } else {
               players[playerId].x -= 20;
           }
       } else if(msg.data.keyPressed === "right"){
           if(player.x + 20 > 1380){
               players[playerId].x = 1380;
           } else {
               players[playerId].x += 20;
           }
       } else if(msg.data.keyPressed === "up"){
           if(player.y + 20 > 760){
               players[playerId].y = 760;
           } else {
               players[playerId].y += 20;
           }

       } else if(msg.data.keyPressed === "down"){
            if(player.y - 20 < 20){
                players[playerId].y = 20;
            } else {
                players[playerId].y -= 20;
            }
       }
    });
}


function finishGame(playerId) {}

function resetServerState() {
    peopleAccessingTheWebsite = 0;
    gameOn = false;
    gameTickerOn = false;
    totalPlayers = 0;
    alivePlayers = 0;
    for (let item in playerChannels) {
        playerChannels[item].unsubscribe();
    }
}

function startShipAndBullets() {}

function startMovingPhysicsWorld() {}

function calcRandomVelocity() {}

function randomAvatarSelector() {}