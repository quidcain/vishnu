var config = {};
// ------------------------------------------------------------------------------------------------------------------------
//Constructor for Recovery and skips arrays
function CyclicalArray(array) {
	this.currentIndex = 0;
	this.values = array;
}
CyclicalArray.prototype.getValue = function() {
	if (!this.values || this.values.length == 0)
		return 0;
	if (this.currentIndex == this.values.length) {
		this.currentIndex = 0;
	}
	return this.values[this.currentIndex++];
};
// ------------------------------------------------------------------------------------------------------------------------
const BaseBet = new CyclicalArray([1, 2, 3, 4]);    		// Set the base bet here.
// ------------------------------------------------------------------------------------------------------------------------
const BaseCashout = new CyclicalArray([2, 1.5, 1.5, 3]);		// Set the base cashout here
// ------------------------------------------------------------------------------------------------------------------------
const Skips = new CyclicalArray([0, 1, 2, 3, -0, 2, 3, -2]);
// ------------------------------------------------------------------------------------------------------------------------
const RecoveryCashouts = new CyclicalArray([1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2]);	// Set the recovery cashouts here
const RecoveryBets = new CyclicalArray([5, 6, 7, 8, 9, 10, 11, 12]);	// Set the bets to do after a loss here
// ------------------------------------------------------------------------------------------------------------------------
const SoftRecovery = 0;	// Set this to zero for lower risk, set to one for lucky recovery...
// ------------------------------------------------------------------------------------------------------------------------
const LuckyRecovery = 0;	// Set this to one if you feel especially lucky...
// ------------------------------------------------------------------------------------------------------------------------
const StopScriptOnContinuousLoss = 1;	// Set this to one to stop instead of reset
// ------------------------------------------------------------------------------------------------------------------------
const ProfitThresholdToStopScript = 545;
// ------------------------------------------------------------------------------------------------------------------------
const TestMode = {
	active: true,
	lastGame: {
		wager: false,
		cashout: undefined,
		reset: function() {
			this.wager = false;
			this.cashout = undefined;
		}	
	}
};
// ------------------------------------------------------------------------------------------------------------------------
const SuperRecovery = {
	occurrence: [2, 0, -1, 2, 3, 5, 2, 4, 5, 3, 3, 2],
	threshold: [20, 0, 1.10, 10, 16, 12, 19, 21, 20, 32, 25, 28],
	currentIndex: 0,
	occurrenceCounter: 0,
	isPassed() {
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
	      this.occurrenceCounter=0;
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
	   		log(`Waiting for ${Math.abs(curOccurr) - this.occurrenceCounter} SuperRecovery to complete`);
	   }
	   //log(`Game crashed at ${lastGame.bust}x`);
	   if (this.currentIndex == this.occurrence.length - 1) {
	      this.currentIndex = 0;
	   }
	   return returnValue;
	},
	containsNow(sym) {
		if (this.occurrence[this.currentIndex] == sym) {
			return true;
		}
		if (this.threshold[this.currentIndex] == sym) {
			return true;
		}
		return false;
	}
};
// ------------------------------------------------------------------------------------------------------------------------
const MasterRecovery = {
	enable: true, //set to false to disable checks for MasterRecovery
	occurrence: [-3, 5, -4, 2],
	threshold: [11, 3, 2, 1],
	currentMasterSlot: undefined,
	masterCashouts: [
		[1, 2, 3, 4],
		[1, 2, 3, 4],
		[1, 2, 3, 4],
		[1, 2, 3, 4]
	],
	masterBets: [
		[1, 2, 3, 4],
		[1, 2, 3, 4],
		[1, 2, 3, 4],
		[1, 2, 3, 4]
	],
	isPassed() {
		const games = engine.history.toArray();
		log("Checking MasterRecovery condition");
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
				log("Activating MasterRecovery mode");
				log("due to passed");
				log(`threshold = ${this.threshold[i]} ${this.occurrence[i]} times.`);
				log(`(index of array = ${i}`);
				return true;
			}
		}
		log("MasterRecovery didn't pass");
		return false;
	}
};
if (MasterRecovery.occurrence.length != MasterRecovery.threshold.length) {
	stop("MasterRecovery.occurrence must be equal MasterRecovery.threshold")
}
// ------------------------------------------------------------------------------------------------------------------------
function GetLastGame() {
	const lastGame = engine.history.first();
	if (TestMode.active) {
		lastGame.wager = TestMode.lastGame.wager;
		if (TestMode.lastGame.cashout < lastGame.bust) {
			lastGame.cashedAt = TestMode.lastGame.cashout;
		}
	}
	return lastGame;
}
// ------------------------------------------------------------------------------------------------------------------------
const BaseMode = {
	statCallback() {},
	start() {
		if((games % 10) == 0) {
			const sessionResult = Math.ceil(((userInfo.balance / 100) - startBalance) * 100) / 100;
			log(`Current session result: ${sessionResult} bits`);
			this.statCallback();
		}

		this.startCallback();
		
		games++;	
	},
	end() {
		const lastGame = GetLastGame();
		
		this.endCallback(lastGame);

		TestMode.lastGame.reset();	
	}
};
// ------------------------------------------------------------------------------------------------------------------------
const NormalMode = {
	statCallback() {
		if (sessionResult >= ProfitThresholdToStopScript) {
			gameState = -2;
		}
	},
	startCallback() {
		if (MasterRecovery.isPassed()) {
			MasterMode.startCallback();
			gameMode = MasterMode;
			return;
		}
		switch(gameState) {
			case -2:
				stop("Stopped");
				break;
			case -1:
				log("Triggering reset from skips array"); 
				gameState = 0;
				BetSoFar = SoftRecovery;
				break;
			case 0:
				PlaceBet(BaseBet.getValue(), BaseCashout.getValue());
				break;
			case 1:
			case 2:
			case 3:
			case 4:
			case 5:
			case 6:
			case 7:
			case 8:
				if (gamesToSkip == -1 || gamesToSkip == 'r' || SuperRecovery.containsNow('r')) { 
					gameState = -1; 
					return; 
				}

				if (gamesToSkip == -2 || gamesToSkip == 's' || SuperRecovery.containsNow('s')) { 
					gameState = -2; 
					return; 
				}
				
				if (gamesToSkip <= 0) {
					if (SuperRecovery.isPassed()) {
						DoRecoveryMode();
					}
				} else {
					gamesToSkip--;
					if (gamesToSkip === 0) {
						log("Recovery after this game !");
					}
					else {
						log(`Skipping ${gamesToSkip} more games...`);
					}
				}
				break;
			default:
				gameState = -1;
				break;
		}
	},
	endCallback(lastGame) {
		if (!lastGame.wager) {
			log("Not betted");
			return;
		}
		if (lastGame.cashedAt) {
			if(gameState == 0) {
				log("Won!");
			} else {
				log(`Won! Recovered from ${gameState} deep loss streak!`);
			}
			gameState = 0;
			BetSoFar = SoftRecovery;
		} else {
			gameState++;
			gamesToSkip = Skips.getValue();
			if(gamesToSkip > 0) {
				log(`Lost! Waiting ${gamesToSkip} games...`);
			} else {
				log("Lost!");
			}
		}
	}
};
NormalMode.__proto__ = BaseMode;

const MasterMode = {
	startCallback() {
		log("Master recovery startCallback");
	},
	endCallback(lastGame) {
		log("Master recovery endCallback");
		gameMode = NormalMode;
	}
};
MasterMode.__proto__ = BaseMode;
// ------------------------------------------------------------------------------------------------------------------------
function DoRecoveryMode() {
	//log(`Bet so far this loss streak: ${BetSoFar}`);
	//const RecoverBet = Math.ceil((Math.pow(Math.ceil(100 / ((RecoveryCashouts[gameState-1] * 100) - 100)), gameState) * BetSoFar)); 
	const RecoverBet = RecoveryBets.getValue();
	if (LuckyRecovery != 0) { 
		RecoverBet += (LuckyRecovery * gameState); 
	}
	
	PlaceBet(RecoverBet, RecoveryCashouts.getValue());
}
// ------------------------------------------------------------------------------------------------------------------------
function PlaceBet(bits, cashout) {
	log(`Betting ${bits} for cashout ${cashout}x`);
	BetSoFar += bits;
	if (!TestMode.active) {
		engine.bet(bits * 100, cashout);
	}
	TestMode.lastGame.wager = true;
	TestMode.lastGame.cashout = cashout;
	log(" ");
}
// ------------------------------------------------------------------------------------------------------------------------

let startBalance = userInfo.balance / 100; 
log(`Starting script with balance ${startBalance}`);
let gameState = 0; 
let gamesToSkip = 0; 
let BetSoFar = 0; 
let games = 1;
let gameMode = NormalMode;

engine.on('GAME_STARTING', () => gameMode.start());
engine.on('GAME_ENDED', () => gameMode.end());
