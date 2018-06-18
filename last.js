var config = {};
// ------------------------------------------------------------------------------------------------------------------------
var BaseBet = 1;    		// Set the base bet here.
// ------------------------------------------------------------------------------------------------------------------------
var BaseCashout = 2;		// Set the base cashout here
// ------------------------------------------------------------------------------------------------------------------------
//Constructor for Recovery and skips arrays
function CyclicalArray(array) {
	this.currentIndex = 0;
	this.values = array;
}
CyclicalArray.prototype.getValue = function() {
	if (this.currentIndex == this.values.length) {
		this.currentIndex = 0;
	}
	return this.values[this.currentIndex++];
};
// ------------------------------------------------------------------------------------------------------------------------
var Skips = new CyclicalArray([0, 1, 2, 3, -0, 2, 3, -2]);;
// ------------------------------------------------------------------------------------------------------------------------
var RecoveryCashouts = new CyclicalArray([1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2]);	// Set the recovery cashouts here
var RecoveryBets = new CyclicalArray([5, 6, 7, 8, 9, 10, 11, 12]);	// Set the bets to do after a loss here
// ------------------------------------------------------------------------------------------------------------------------
var SoftRecovery = 0;	// Set this to zero for lower risk, set to one for lucky recovery...
// ------------------------------------------------------------------------------------------------------------------------
var LuckyRecovery = 0;	// Set this to one if you feel especially lucky...
// ------------------------------------------------------------------------------------------------------------------------
var StopScriptOnContinuousLoss = 1;	// Set this to one to stop instead of reset
// ------------------------------------------------------------------------------------------------------------------------
var ProfitThresholdToStopScript = 545;
// ------------------------------------------------------------------------------------------------------------------------
var TestMode = {
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
var SuperRecovery = {
	occurrence: [2, 0, -1, 2, 3, 5, 2, 4, 5, 3, 3, 2],
	threshold: [20, 0, 1.10, 10, 16, 12, 19, 21, 20, 32, 25, 28],
	currentIndex: 0,
	occurrenceCounter: 0,
	isPassed: function () {
	   var lastGame = engine.history.first();
	   var curOccurr = this.occurrence[this.currentIndex];
	   var curTresh = this.threshold[this.currentIndex];
	   var returnValue = false;
	   //log ("curOccurr = ", curOccurr, " curTresh = ", curTresh); 
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
	         log('skipping the array elements');
	      } else if (curOccurr >= 0) {
	         log('val is less than ', curTresh ,' continuously in ',curOccurr,' running times', lastGame.bust ,'x');
	      } else if (curOccurr <= 0) {
	         log('val is greater than ', curTresh ,' continuously in ',Math.abs(curOccurr),' running times', lastGame.bust ,'x');
	      }
	      returnValue = true;
	      this.occurrenceCounter = 0;
	      this.currentIndex++;
	   }
	   log('Game crashed at ', lastGame.bust ,'x');
	   if (this.currentIndex == this.occurrence.length - 1) {
	      this.currentIndex = 0;
	   }
	   return returnValue;
	}
};
// ------------------------------------------------------------------------------------------------------------------------
function MasterConditionPassed() { //return true to pass master condition
	//for the sake of example:
	//var games = engine.history.toArray();
	//if (games[0].bust < 5 && games[1].bust < 5 && games[2].bust < 5) {
	//   log("Below 5 3 or more times!")
	//	 return true;
	//} else {
	return false;
	//}
}
// ------------------------------------------------------------------------------------------------------------------------
function GetLastGame() {
	var lastGame = engine.history.first();
	if (TestMode.active) {
		lastGame.wager = TestMode.lastGame.wager;
		if (TestMode.lastGame.cashout < lastGame.bust) {
			lastGame.cashedAt = TestMode.lastGame.cashout;
		}
	}
	return lastGame;
}
// ------------------------------------------------------------------------------------------------------------------------
function DoRecoveryMode() {
	log('Bet so far this loss streak: ' + BetSoFar);
	//var RecoverBet = Math.ceil((Math.pow(Math.ceil(100 / ((RecoveryCashouts[gameState-1] * 100) - 100)), gameState) * BetSoFar)); 
	var RecoverBet = RecoveryBets.getValue();
	if (LuckyRecovery != 0) { 
		RecoverBet += (LuckyRecovery * gameState); 
	}
	
	PlaceBet(RecoverBet, RecoveryCashouts.getValue());
}
// ------------------------------------------------------------------------------------------------------------------------
function PlaceBet(bits, cashout) {
	log('Betting ' + bits + ' for cashout ' + cashout + 'x');
	BetSoFar += bits;
	if (!TestMode.active) {
		engine.bet(bits * 100, cashout);
	}
	TestMode.lastGame.wager = true;
	TestMode.lastGame.cashout = cashout;
	log(' ');
}
// ------------------------------------------------------------------------------------------------------------------------

var startBalance = userInfo.balance / 100; 
log('Starting script with balance ' + startBalance);
var gameState = 0; 
var gamesToSkip = 0; 
var BetSoFar = 0; 
var games = 1;

engine.on('GAME_STARTING', function()  {
	if (MasterConditionPassed()) {
		stop("Stop due to master condition")
	}
	if((games % 10) == 0) {
		var sessionResult = Math.ceil(((userInfo.balance / 100) - startBalance) * 100) / 100;
		log('Current session result: ', sessionResult, ' bits');
		if (sessionResult >= ProfitThresholdToStopScript) {
			gameState = -2;
		}
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
			PlaceBet(BaseBet, BaseCashout);
			break;
		case 1:
		case 2:
		case 3:
		case 4:
		case 5:
		case 6:
		case 7:
		case 8:
			if (gamesToSkip == -1) { 
				gameState = -1; 
				return; 
			}

			if (gamesToSkip == -2) { 
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
					log('Recovery after this game !');
				}
				else {
					log('Skipping ' + gamesToSkip + ' more games...');
				}
			}
			break;
		default:
			gameState = -1;
			break;
	}
	games++;
});


engine.on('GAME_ENDED', function() {
	var lastGame = GetLastGame();
	if (!lastGame.wager) {
		return;
	}
	
	if (lastGame.cashedAt) {
		if(gameState == 0) {
			log('Won!');
		} else {
			log('Recovered from ' + gameState + ' deep loss streak!');
		}
		gameState = 0;
		BetSoFar = SoftRecovery;
	} else {
		gameState++;
		gamesToSkip = Skips.getValue();
		if(gamesToSkip > 0) {
			log('Lost! Waiting ' + gamesToSkip + ' games...');
		}
	}
	TestMode.lastGame.reset();
});
