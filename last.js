var config = {};
// ------------------------------------------------------------------------------------------------------------------------
const SATOSHIS_IN_BIT = 100;
function toSatoshis(bits) {
	return bits * SATOSHIS_IN_BIT;
}
function toBits(satoshis) {
	return satoshis / SATOSHIS_IN_BIT;
}
const onEnd = {
	TO_NORMAL: "TO_NORMAL",
	RESTART_WHOLE: "RESTART_WHOLE",
	STOP_WHOLE: "STOP_WHOLE"
};
// ------------------------------------------------------------------------------------------------------------------------
const stopScriptOnContinuousLoss = 1;	// Set this to one to stop instead of reset
// ------------------------------------------------------------------------------------------------------------------------
const testModeConfig = {
	active: true,
	startBalance: 100 //bits
};
// ------------------------------------------------------------------------------------------------------------------------
const baseModeConfig = {
	gamesInSession: 10
};
// ------------------------------------------------------------------------------------------------------------------------
const superRecoveryConfig = {
	occurrence: [2, 0, -1, 2, 3, 5, 2, 4, 5, 3, 3, 2],
	threshold: [20, 0, 1.10, 10, 16, 12, 19, 21, 20, 32, 25, 28]
};
const recoveryConfig = {
	cashouts: [1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2],
	bets: [5, 6, 7, 8, 9, 10, 11, 12],
	luckyRecovery: 0 // Set this to one if you feel especially lucky...
};
const normalModeConfig = {
	gameState: 0, 
	gamesToSkip: 0,
	softRecovery: 0,	// Set this to zero for lower risk, set to one for lucky recovery...	
	profitThresholdToStopScript: 50,
	baseBet: [1, 2, 3, 4],    		// Set the base bet here.
	baseCashout: [2, 1.5, 1.5, 3],		// Set the base cashout here
	skips: ["w", 0, 2, 3, -0, 2, 3, -2]
};
//Object.assign(normalModeConfig, baseModeConfig);
// ------------------------------------------------------------------------------------------------------------------------
const masterModeConfig = {
	enabled: true, //set to false to disable checks for masterRecovery
	onWin: onEnd.RESTART_WHOLE,
	occurrence: [-3, 5, -4, 2],
	threshold: [11, 3, 2, 1],
	cashouts: [
		[1, 2, 3, 4],
		[1, 2, 3, 4],
		[1, 2, 3, 4],
		[1, 2, 3, 4]
	],
	bets: [
		[1, 2, 3, 4],
		[1, 2, 3, 4],
		[1, 2, 3, 4],
		[1, 2, 3, 4]
	],
};
//Object.assign(masterModeConfig, baseModeConfig);
// ------------------------------------------------------------------------------------------------------------------------
const superRecovery2Config = {
	occurrence: [-2, 0, -1, 2, 3, 5, 2, 4, 5, 3, 3, 2],
	threshold: [20, 0, 1.10, 10, 16, 12, 19, 21, 20, 32, 25, 28]
};
const snippingModeConfig = {
	onWin: onEnd.STOP_WHOLE,
	bets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
	games: [10, 15, 25, 35, 45, 60, 25, 10, 15, 20],
	cashouts: [1000, 2000, 2200, 3000, 4000, 5000, 6000, 500, 1000, 1500]
};
//Object.assign(snippingModeConfig, baseModeConfig);
// ------------------------------------------------------------------------------------------------------------------------
if (masterModeConfig.occurrence.length != masterModeConfig.threshold.length) {
	stop("masterRecovery.occurrence must be equal masterRecovery.threshold")
}
function TestMode(config) {
	Object.assign(this, config);
	this.currentIndex = 0;
	this.occurrenceCounter = 0;
	this.lastGame = {
		wager: false,
		cashout: undefined,
		reset: function() {
			this.wager = false;
			this.cashout = undefined;
		}	
	}
	this.balance = 0; //bits
}
// ------------------------------------------------------------------------------------------------------------------------
function CyclicalArray(array) {
	this.currentIndex = 0;
	this.values = array;
};
CyclicalArray.prototype.getValue = function() {
	if (!this.values || this.values.length == 0)
		return 0;
	if (this.currentIndex == this.values.length) {
		this.currentIndex = 0;
	}
	return this.values[this.currentIndex++];
};
// ------------------------------------------------------------------------------------------------------------------------
function SuperRecovery(config) {
	Object.assign(this, config);
	this.currentIndex = 0;
	this.occurrenceCounter = 0;
}
SuperRecovery.prototype.isPassed = function() {
	const lastGame = engine.history.first();
	const curOccurr = this.occurrence[this.currentIndex];
	const curTresh = this.threshold[this.currentIndex];
	let returnValue = false;
	//log (`curOccurr = ${curOccurr} curTresh = ${curTresh}`); 
	if (curOccurr  == 0 && curTresh == 0) {
		this.occurrenceCounter = 0;
	} else if (curOccurr > 0 && lastGame.bust <= curTresh) {
		this.occurrenceCounter++;
	} else if (curOccurr < 0 && lastGame.bust >= curTresh) {
		this.occurrenceCounter++;
	} else {
		this.occurrenceCounter = 0;
	}
	if (this.occurrenceCounter== Math.abs(curOccurr)) {
		if (curOccurr == 0 && curTresh == 0) {
			log("Skipping the array elements");
		} else if (curOccurr >= 0) {
			log(`Val is less than ${curTresh} continuously in ${curOccurr} running times ${lastGame.bust}x`);
		} else if (curOccurr <= 0) {
		log(`Val is greater than ${curTresh} continuously in ${Math.abs(curOccurr)} running times ${lastGame.bust}x`);
		}
		returnValue = true;
		this.occurrenceCounter = 0;
		this.currentIndex++;
	} else {
		log(`Waiting for ${Math.abs(curOccurr) - this.occurrenceCounter} superRecovery to complete`);
	}
	//log(`Game crashed at ${lastGame.bust}x`);
	if (this.currentIndex == this.occurrence.length - 1) {
		this.currentIndex = 0;
	}
	return returnValue;
};
SuperRecovery.prototype.containsNow = function(sym) {
	if (this.occurrence[this.currentIndex] == sym) {
		return true;
	}
	if (this.threshold[this.currentIndex] == sym) {
		return true;
	}
	return false;
}
// ------------------------------------------------------------------------------------------------------------------------
function Recovery() {
	Object.assign(this, recoveryConfig);
	this.cashouts = new CyclicalArray(recoveryConfig.cashouts);
	this.bets = new CyclicalArray(recoveryConfig.bets);
}
Recovery.prototype.run = function() {
	let recoveryBet = this.bets.getValue();
	if (this.luckyRecovery != 0) { 
		recoveryBet += (this.luckyRecovery * gameMode.gameState); 
	}
	
	gameMode.placeBet(recoveryBet, this.cashouts.getValue());
}
// ------------------------------------------------------------------------------------------------------------------------
function BaseMode(testMode) {
	Object.assign(this, baseModeConfig);
	this.testMode = testMode;
	this.games = 1;
	this.betSoFar = 0;
	if (this.testMode.active) {
		this.startBalance = this.testMode.startBalance;
	} else {
		this.startBalance = toBits(userInfo.balance);
	}
};
BaseMode.prototype.calculateSessionResult = function() {
	if (this.testMode.active) {
		return this.testMode.balance;
	} else {
		return toBits(userInfo.balance) - this.startBalance;
	}
};
BaseMode.prototype.statCallback = function(sessionResult) {};
BaseMode.prototype.start = function() {
	if((this.games % this.gamesInSession) == 0) {
		const sessionResult = this.calculateSessionResult();
		log(`Current session result: ${sessionResult} bits`);
		this.statCallback(sessionResult);
	}

	this.startCallback();
	
	this.games++;	
};
BaseMode.prototype.end = function() {
	const lastGame = this.getLastGame();
	
	if (!lastGame.wager) {
		log("Not betted");
		return;
	}
	if (lastGame.cashedAt) {
		this.wonCallback(lastGame);
		//log(`Adding to current balance (${this.testMode.balance}) ${toBits(lastGame.wager * lastGame.cashedAt)}`);
		this.testMode.balance += toBits(lastGame.wager * lastGame.cashedAt);
	} else {
		this.lostCallback(lastGame);
		//log(`Removing from current balance (${this.testMode.balance}) ${toBits(lastGame.wager)}`);
		this.testMode.balance -= toBits(lastGame.wager);
	}

	this.testMode.lastGame.reset();	
};
BaseMode.prototype.wonCallback = function(lastGame) {};
BaseMode.prototype.lostCallback = function(lastGame) {};
BaseMode.prototype.getLastGame = function() {
	const lastGame = engine.history.first();
	if (this.testMode.active) {
		lastGame.wager = this.testMode.lastGame.wager;
		if (this.testMode.lastGame.cashout < lastGame.bust) {
			lastGame.cashedAt = this.testMode.lastGame.cashout;
		}
	}
	return lastGame;
};
BaseMode.prototype.placeBet = function(bits, cashout) {
	log(`Betting ${bits} for cashout ${cashout}x`);
	this.betSoFar += bits;
	if (!this.testMode.active) {
		engine.bet(toSatoshis(bits), cashout);
	}
	this.testMode.lastGame.wager = toSatoshis(bits);
	this.testMode.lastGame.cashout = cashout;
	log(" ");
};
// ------------------------------------------------------------------------------------------------------------------------
function NormalMode() {
	BaseMode.call(this, testMode);
	Object.assign(this, normalModeConfig);
	this.baseBet = new CyclicalArray(normalModeConfig.baseBet);
	this.baseCashout = new CyclicalArray(normalModeConfig.baseCashout);
	this.skips = new CyclicalArray(normalModeConfig.skips);
	this.superRecovery = new SuperRecovery(superRecoveryConfig);
	this.recovery = new Recovery();
};
NormalMode.prototype = Object.create(BaseMode.prototype);
NormalMode.prototype.statCallback = function(sessionResult) {
	if (sessionResult >= this.profitThresholdToStopScript) {
		this.gameState = -2;
	}
};
NormalMode.prototype.startCallback = function() {
	if (this.gamesToSkip == "w" || this.superRecovery.containsNow("w,w")) {
		snippingMode.startCallback();
		this.gamesToSkip = 0;
		this.superRecovery.currentIndex++;
		gameMode = snippingMode;
		return;
	}
	if (masterMode.enabled && masterMode.isPassed()) {
		masterMode.startCallback();
		gameMode = masterMode;
		return;
	}
	//log (`gameState = ${this.gameState}`);
	switch(this.gameState) {
		case -2:
			stop("Stopped");
			break;
		case -1:
			log("Triggering reset from skips array"); 
			this.gameState = 0;
			this.betSoFar = this.softRecovery;
			break;
		case 0:
			this.placeBet(this.baseBet.getValue(), this.baseCashout.getValue());
			break;
		case 1:
		case 2:
		case 3:
		case 4:
		case 5:
		case 6:
		case 7:
		case 8:
			if (this.gamesToSkip == -1 || this.gamesToSkip == 'r' || this.superRecovery.containsNow('r')) { 
				this.gameState = -1; 
				return; 
			}

			if (this.gamesToSkip == -2 || this.gamesToSkip == 's' || this.superRecovery.containsNow('s')) { 
				this.gameState = -2; 
				return; 
			}
			
			if (this.gamesToSkip <= 0) {
				if (this.superRecovery.isPassed()) {
					this.recovery.run();
				}
			} else {
				this.gamesToSkip--;
				if (this.gamesToSkip === 0) {
					log("Recovery after this game !");
				}
				else {
					log(`Skipping ${this.gamesToSkip} more games...`);
				}
			}
			break;
		default:
			this.gameState = -1;
			break;
	}
};
NormalMode.prototype.wonCallback = function(lastGame) {
	if(this.gameState == 0) {
		log("Won!");
	} else {
		log(`Won! Recovered from ${this.gameState} deep loss streak!`);
	}
	this.gameState = 0;
	this.betSoFar = this.softRecovery;
}
NormalMode.prototype.lostCallback = function(lastGame) {
	this.gameState++;
	this.gamesToSkip = this.skips.getValue();
	if(this.gamesToSkip > 0) {
		log(`Lost! Waiting ${this.gamesToSkip} games...`);
	} else {
		log("Lost!");
	}
}
// ------------------------------------------------------------------------------------------------------------------------
function MasterMode() {
	if (!Object.values(onEnd).includes(masterModeConfig.onWin)) {
		stop("Incomatible value of master mode on win");
	}
	BaseMode.call(this, testMode);
	Object.assign(this, masterModeConfig);
	this.currentMasterSlot = null;
	this.currentBetIndex = 0; //index in bets and cashouts arrays
	this.superRecovery = new SuperRecovery();
};
MasterMode.prototype = Object.create(BaseMode.prototype);
MasterMode.prototype.startCallback = function() {
	log("Master recovery startCallback");

	if (this.currentBetIndex >= this.bets.length
		|| this.currentBetIndex >= this.cashouts.length) {
		this.currentBetIndex = 0;
	}
	const bet = this.bets[this.currentMasterSlot][this.currentBetIndex];
	const cashout = this.cashouts[this.currentMasterSlot][this.currentBetIndex];
	this.placeBet(bet, cashout);
	this.currentBetIndex++;
};
MasterMode.prototype.wonCallback = function(lastGame) {
	log("Master recovery endCallback");
	log("Won!");
	if (this.onWin == onEnd.TO_NORMAL) {
		gameMode = normalMode;
	} else if (this.onWin == onEnd.RESTART_WHOLE) {
		normalMode = new NormalMode();
		masterMode = new MasterMode();
		gameMode = normalMode;
	} else {
		stop("Forbidden win action in master module!")
	}
};
MasterMode.prototype.lostCallback = function(lastGame) {
	log("Master recovery endCallback");
	log("Lost!");
	gameMode = normalMode;
};
MasterMode.prototype.isPassed = function() {
	const games = engine.history.toArray();
	log("Checking masterRecovery condition");
	for (let i = 0; i < this.occurrence.length; i++) {
		const absoluteOccurr = this.occurrence[i];
		const gamesToCompare = games.slice(0, absoluteOccurr);
		/*let str = "";
		for (let j in gamesToCompare) {
			str += `${gamesToCompare[j].bust} `;
		}
		log(str);*/
		if (gamesToCompare.every(game => this.occurrence[i] > 0 && game.bust <= this.threshold[i] || 
										 this.occurrence[i] < 0 && game.bust >= this.threshold[i])) {
			log("Activating masterRecovery mode");
			//log("due to passed");
			//log(`threshold = ${this.threshold[i]} ${this.occurrence[i]} times.`);
			//log(`(index of array = ${i})`);
			this.currentMasterSlot = i;
			return true;
		}
	}
	log("masterRecovery didn't pass");
	return false;
};
function SnippingMode() {
	BaseMode.call(this, testMode);
	Object.assign(this, snippingModeConfig);
	this.currentIndex = 0;
	this.currentGameCounter = 0;
	this.superRecovery = new SuperRecovery(superRecovery2Config);
};
SnippingMode.prototype = Object.create(BaseMode.prototype);
SnippingMode.prototype.startCallback = function() {
	log("Snipping Mode startCallback");
	if (this.superRecovery.isPassed()) {
		if (this.games[this.currentIndex] == undefined) {
			this.currentIndex = 0;
		}
		if (this.games[this.currentIndex] == this.currentGameCounter) {
			this.currentIndex++;
			this.currentGameCounter = 0;
		}
		const bet = this.bets[this.currentIndex];
		const cashout = this.cashouts[this.currentIndex];
		this.placeBet(bet, cashout);
		this.currentGameCounter++;
	} else {
		log("superRecovery2 didn't pass")
	}
};
SnippingMode.prototype.wonCallback = function() {
	log("Snipping Mode endCallback");
	log("Won!");
	if (this.onWin == onEnd.STOP_WHOLE) {
		stop("Stopped after snippingMode");
	} else if (this.onWin == onEnd.TO_NORMAL) {
		gameMode = normalMode;
	} 
};
SnippingMode.prototype.lostCallback = function() {
	log("Snipping Mode endCallback");
	log("Lost!");
	stop("Stopped after snippingMode");
};
// ------------------------------------------------------------------------------------------------------------------------
let testMode = new TestMode(testModeConfig);
// ------------------------------------------------------------------------------------------------------------------------
let normalMode = new NormalMode(testMode);
// ------------------------------------------------------------------------------------------------------------------------
let masterMode = new MasterMode(testMode);
// ------------------------------------------------------------------------------------------------------------------------
let snippingMode = new SnippingMode(testMode);

let gameMode = normalMode;
log(`Starting script with balance ${gameMode.startBalance}`); 

engine.on('GAME_STARTING', () => gameMode.start());
engine.on('GAME_ENDED', () => gameMode.end());


