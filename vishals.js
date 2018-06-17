var config = {};
// ------------------------------------------------------------------------------------------------------------------------
var BaseBet = 1;    		// Set the base bet here.
// ------------------------------------------------------------------------------------------------------------------------
var BaseCashout = 2;		// Set the base cashout here
// ------------------------------------------------------------------------------------------------------------------------
var Skips = [1, -2, -2, -2, -2, -2, -2, -2];		// Set skips here, put -1 for reset, put -2 for stop
// ------------------------------------------------------------------------------------------------------------------------
var RecoveryCashouts = [1.5, 1.6, 1.7, 2, 2, 2, 2, 2];	// Set the recovery cashouts here
var RecoveryBets     = [2, 2, 2, 1, 1, 1, 1, 1];			// Set the bets to do after a loss here
// ------------------------------------------------------------------------------------------------------------------------
var SoftRecovery = 0;	// Set this to zero for lower risk, set to one for lucky recovery...
// ------------------------------------------------------------------------------------------------------------------------
var LuckyRecovery = 0;	// Set this to one if you feel especially lucky...
// ------------------------------------------------------------------------------------------------------------------------
var StopScriptOnContinuousLoss = 1;	// Set this to one to stop instead of reset
// ------------------------------------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------------------------------------

var startBalance = userInfo.balance / 100; log('Starting script with balance ' + startBalance);
var gameState = 0; var gamesToSkip = 0; var BetSoFar = 0; var games = 1;

engine.on('GAME_STARTING', function() 
{
	if((games % 10) == 0) log('Current session result: ' + Math.ceil(((userInfo.balance / 100) - startBalance) * 100) / 100 + ' bits');
	
	switch(gameState)
	{
		case -2:
			stop("Stopped");
			break;
		case -1:
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
			if(Skips[gameState-1] == -1)	{ gameState = -1; return; }
			
			if(gamesToSkip <= 0)
			{
				log('Bet so far this loss streak: ' + BetSoFar);
				//var RecoverBet = Math.ceil((Math.pow(Math.ceil(100 / ((RecoveryCashouts[gameState-1] * 100) - 100)), gameState) * BetSoFar)); 
				var RecoverBet = RecoveryBets[gameState - 1];
				if(LuckyRecovery != 0) { RecoverBet += (LuckyRecovery * gameState); }
				
				PlaceBet(RecoverBet, RecoveryCashouts[gameState-1]);
			}
			else
			{
				gamesToSkip--;
				if(gamesToSkip === 0) log('Recovery after this game !');
				else log('Skipping ' + gamesToSkip + ' more games...');
			}
				break;
		default:
			gameState = -1;
			break;
	}
	games++;
});



engine.on('GAME_ENDED', function()
{
	var lastGame = engine.history.first()
	if (!lastGame.wager) return;
	
	if (lastGame.cashedAt) 
	{
		if(gameState == 0)
			log('Won!');
		else
			log('Recovered from ' + gameState + ' deep loss streak!');
		
		gameState = 0;
		BetSoFar = SoftRecovery;
	}
	else
	{
		gameState++;
		gamesToSkip = Skips[gameState-1];
		if(gamesToSkip > 0)
			log('Lost! Waiting ' + gamesToSkip + ' games...');
		else
			log('Lost hard! Skipping one game and resetting...');
	}
});


function PlaceBet(Bits, Cashout)
{
	log('Betting ' + Bits + ' for cashout ' + Cashout + 'x');
	BetSoFar += Bits;
	engine.bet(Bits * 100, Cashout);
	log(' ');
}
