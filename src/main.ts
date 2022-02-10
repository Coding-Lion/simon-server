import * as express from "express"
import * as ExpressWs from "express-ws"
import { Player } from "./player"

const app = express();
const expressWs = ExpressWs(app);


let gameState = "waiting";

let players: Player[] = [];

const dashboardSockets = []


app.use(function (req, res, next) {
  req.testing = 'testing';
  return next();
});

app.get('/', function (req, res, next) {
  console.log('get route', req.testing);
  res.end();
});


app.ws('/dashboard', function (ws, req) {
  console.log('dashboard connected');

  ws.on('message', function (msg) {
    const data = JSON.parse(msg);
    if (data.type == 'initDashboard') {
      dashboardSockets.push(ws);
      sendDashboardMessage({ type: "scoreboard", data: players.map(player => player.getJson()) });

    }


    if (data.type == 'startGame') {
      if (gameState == 'running' || gameState == 'stopping') return;
      gameState = 'running'
      startGame();
    }

    if (data.type == 'stopGame') {
      if (gameState == 'running') gameState = 'stopping'
    }
    if (data.type == 'stopGame') {
      if (gameState == 'running') gameState = 'stopping'
    }
  });
});

app.ws('/', function (ws, req) {

  if (gameState == 'running' || gameState == 'stopping') return;

  console.log('new player');

  let player: Player;

  ws.on('message', function (msg) {


    if (msg == "1") {
      if (player) {
        console.log("init already done")
        // TODO: delte old player
        return;
      }
      console.log("init player")
      player = new Player(ws);
      players.push(player);
      const array = new Uint8Array(1);
      array[0] = 1;
      ws.send(array, { binary: true });
      
      sendDashboardMessage({ type: "scoreboard", data: players.map(player => player.getJson()).sort((a,b)=> a.score - b.score) });
    }

    const args = msg.toString().split(",");
    if (msg[0] == "2") {
      console.log("player response")
      if (player) {
        player.response = args[1];
        player.responseTime = args[2];
      }
    }

  });
});

async function startGame() {
  for (let i = 5; i >= 0; i--) {
    sendDashboardMessage({ type: "status", data: `Spiel startet in ${i}...` })
    await timeout(1000);
  }

  for (const player of players) {
    player.score = 0;
  }
  
  clearChallenge();
  

  for (let i = 1; i < 11; i++) {
    await startRound(i);
    if (gameState == "stopping") {

      gameState = 'stopped';
      break;
    };
  }

  
  players.forEach((player) => {
    try {
      const array = new Uint8Array(1);
      array[0] = 5;
      player.ws.send(array, { binary: true });
    } catch (error) {
      console.error(error);
    }
  })

  sendDashboardMessage({ type: "status", data: `Spiel beendet` })
  gameState = 'stopped';
}

async function startRound(round) {
  sendDashboardMessage({ type: "status", data: `Runde ${round}` });
  await timeout(2000);

  const requiredButton = sendChallenge();
  sendDashboardMessage({ type: "status", data: `Runde ${round} - warte auf Antwort` });

  await awaitChallengeRespose();
  const winningPlayer = sendChallengeResult(requiredButton);
  if (winningPlayer) {
    sendDashboardMessage({ type: "status", data: `Runde ${round} - ${winningPlayer.name} hat gewonnen` });
  } else {
    sendDashboardMessage({ type: "status", data: `Runde ${round} - niemand hat gewonnen` });
  }

  sendDashboardMessage({ type: "scoreboard", data: players.map(player => player.getJson()) });

  await timeout(3000);
  clearChallenge();

  round++;
}

function sendChallenge() {

  const requiredButton = Math.floor(Math.random() * 3) + 1;
  for (const player of players) {
    player.reset();
  }
  players.forEach((player) => {
    try {
      const array = new Uint8Array(2);
      array[0] = 2;
      array[1] = requiredButton;
      player.ws.send(array, { binary: true });
    } catch (error) {
      console.error(error);
    }
  })



  return requiredButton;
}


function sendChallengeResult(requiredButton: number) {
  let winningPlayer: Player;
  for (const player of players) {
    if (player.response == requiredButton && (!winningPlayer || winningPlayer.responseTime < player.responseTime)) {
      winningPlayer = player;
    }
  }
  if (winningPlayer) {
    winningPlayer.score++;
  }
  for (const player of players) {
    const array = new Uint8Array(2);
    array[0] = 3;
    if (player == winningPlayer) {
      array[1] = 1;
    } else {
      array[1] = 0;
    }
    player.ws.send(array, { binary: true });
  }
  return winningPlayer;
}


function clearChallenge() {
  for (const player of players) {
    const array = new Uint8Array(1);
    array[0] = 4;
    player.ws.send(array, { binary: true });
  }
}


async function awaitChallengeRespose() {
  return new Promise<void>(res => {

    let interval;
    let intervalCount = 0;
    interval = setInterval(() => {
      if (intervalCount++ > 25) {

        for (const player of players) {
          if (player.response == 0) {
            player.response = -1
            player.ws.close();
            players = players.filter(p => p != player);
          };

        }
      }


      let roundFinished = true;

      for (const player of players) {
        if (player.response == 0) {
          roundFinished = false;
        }
      }


      if (roundFinished == true) {
        clearInterval(interval);
        res();
      }
    }, 200);
  });

}

function sendDashboardMessage(message: DashboardMessage) {
  dashboardSockets.forEach((socket) => {
    try {
      socket.send(JSON.stringify(message));
    } catch (error) {
      console.error(error);
    }
  })
}

app.get('/dash', function(req, res){
  res.sendFile('public/index.html', { root: __dirname + "/../../" });
})

type DashboardMessage = {
  type: string,
  data: any,
}

function timeout(time) {
  return new Promise<void>((res) => {
    setTimeout(() => res(), time);
  });
}

app.listen(3040);