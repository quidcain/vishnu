var config = {};
// ------------------------------------------------------------------------------------------------------------------------
const stopScriptOnContinuousLoss = 1;	// Set this to one to stop instead of reset
// ------------------------------------------------------------------------------------------------------------------------
const testModeConfig = {
	active: true
};
// ------------------------------------------------------------------------------------------------------------------------
const baseModeConfig = {
	startBalance: userInfo.balance / 100,
	games: 1,
	betSoFar: 0,
	testMode: new TestMode(testModeConfig)
};
// ------------------------------------------------------------------------------------------------------------------------
const superRecoveryConfig = {
	occurrence: [2, 0, -1, 2, 3, 5, 2, 4, 5, 3, 3, 2],
	threshold: [20, 0, 1.10, 10, 16, 12, 19, 21, 20, 32, 25, 28]
};
const recoveryConfig = {
	cashouts: new CyclicalArray([1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2]),
	bets: new CyclicalArray([5, 6, 7, 8, 9, 10, 11, 12]),
	luckyRecovery: 0 // Set this to one if you feel especially lucky...
};
const normalModeConfig = {
	gameState: 0, 
	gamesToSkip: 0,
	softRecovery: 0,	// Set this to zero for lower risk, set to one for lucky recovery...	
	profitThresholdToStopScript: 545,
	baseBet: new CyclicalArray([1, 2, 3, 4]),    		// Set the base bet here.
	baseCashout: new CyclicalArray([2, 1.5, 1.5, 3]),		// Set the base cashout here
	skips: new CyclicalArray([0, 1, 2, 3, -0, 2, 3, -2]),
	superRecovery: new SuperRecovery(superRecoveryConfig),
	recovery: new Recovery(recoveryConfig)
};
Object.assign(normalModeConfig, baseModeConfig);
// ------------------------------------------------------------------------------------------------------------------------
const masterModeConfig = {
	enabled: true, //set to false to disable checks for masterRecovery
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
Object.assign(masterModeConfig, baseModeConfig);
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
function Recovery(config) {
	Object.assign(this, config);
}
Recovery.prototype.run = function() {
	let recoveryBet = this.bets.getValue();
	if (this.luckyRecovery != 0) { 
		recoveryBet += (this.luckyRecovery * gameMode.gameState); 
	}
	
	gameMode.placeBet(recoveryBet, this.cashouts.getValue());
}
// ------------------------------------------------------------------------------------------------------------------------
function BaseMode(config) {
	Object.assign(this, config);
};
BaseMode.prototype.statCallback = function(sessionResult) {};
BaseMode.prototype.start = function() {
	if((this.games % 10) == 0) {
		const sessionResult = Math.ceil(((userInfo.balance / 100) - this.startBalance) * 100) / 100;
		log(`Current session result: ${sessionResult} bits`);
		this.statCallback(sessionResult);
	}

	this.startCallback();
	
	this.games++;	
};
BaseMode.prototype.end = function() {
	const lastGame = this.getLastGame();
	
	this.endCallback(lastGame);

	this.testMode.lastGame.reset();	
};
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
		engine.bet(bits * 100, cashout);
	}
	this.testMode.lastGame.wager = true;
	this.testMode.lastGame.cashout = cashout;
	log(" ");
};
// ------------------------------------------------------------------------------------------------------------------------
function NormalMode(config) {
	Object.assign(this, config);
};
NormalMode.prototype = Object.create(BaseMode.prototype);
NormalMode.prototype.statCallback = function(sessionResult) {
	if (sessionResult >= this.profitThresholdToStopScript) {
		this.gameState = -2;
	}
};
NormalMode.prototype.startCallback = function() {
	if (masterMode.enabled && masterMode.isPassed()) {
		masterMode.startCallback();
		gameMode = masterMode;
		return;
	}
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
NormalMode.prototype.endCallback = function(lastGame) {
	if (!lastGame.wager) {
		log("Not betted");
		return;
	}
	if (lastGame.cashedAt) {
		if(this.gameState == 0) {
			log("Won!");
		} else {
			log(`Won! Recovered from ${this.gameState} deep loss streak!`);
		}
		this.gameState = 0;
		this.betSoFar = this.softRecovery;
	} else {
		this.gameState++;
		this.gamesToSkip = this.skips.getValue();
		if(this.gamesToSkip > 0) {
			log(`Lost! Waiting ${this.gamesToSkip} games...`);
		} else {
			log("Lost!");
		}
	}
};
// ------------------------------------------------------------------------------------------------------------------------
function MasterMode(config) {
	Object.assign(this, config);
	this.currentMasterSlot = null;
	this.currentBetIndex = 0; //index in bets and cashouts arrays
};
MasterMode.prototype = Object.create(BaseMode.prototype);
MasterMode.prototype.startCallback = function() {
	log("Master recovery startCallback");

	if (this.currentIndex >= this.bets.length
		|| this.currentIndex >= this.cashouts.length) {
		this.currentIndex = 0;
	}
	const bet = this.bets[this.currentMasterSlot][this.currentIndex];
	const cashout = this.cashouts[this.currentMasterSlot][this.currentIndex];
	this.placeBet(bet, cashout);
	this.currentIndex++;
};
MasterMode.prototype.endCallback = function(lastGame) {
	log("Master recovery endCallback");
	if (lastGame.cashedAt) {
		log("Won!");
	} else {
		log("Lost!");
	}
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
			log("due to passed");
			log(`threshold = ${this.threshold[i]} ${this.occurrence[i]} times.`);
			log(`(index of array = ${i}`);
			this.currentMasterSlot = i;
			return true;
		}
	}
	log("masterRecovery didn't pass");
	return false;
};
// ------------------------------------------------------------------------------------------------------------------------
const normalMode = new NormalMode(normalModeConfig);
// ------------------------------------------------------------------------------------------------------------------------
const masterMode = new MasterMode(masterModeConfig);

let gameMode = normalMode;
log(`Starting script with balance ${gameMode.startBalance}`); 

engine.on('GAME_STARTING', () => gameMode.start());
engine.on('GAME_ENDED', () => gameMode.end());


