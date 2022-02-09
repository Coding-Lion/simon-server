let playerNameCount = 1;


export class Player {
  ws;
  name = '';
  score = 0;
  response:number = 0;
  responseTime = 10000;

  constructor (ws) {
    this.name = "Spieler " + playerNameCount++;
    this.ws = ws;
  }

  reset() {
    this.response = 0;
    this.responseTime = 10000;
  }

  getJson(){
    return {
      name: this.name,
      score: this.score,
    }
  }
}