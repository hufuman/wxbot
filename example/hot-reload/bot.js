'use strict';

class Bot {
	constructor(weChatBot) {
		this.weChatBot = weChatBot;
	}

	onMsg(userName, msg, sender) {
		console.log(`${userName}: \n\tmsg: ${msg.Content}`);
		if(msg.Content.indexOf('test') >= 0) {
			// send hello wolrd to sender
			this.weChatBot.sendTextMsg(sender.userName, 'hello world', (err, retCode) => {
				console.log('send msg ' + (err ? err : ' success.'));
			});
		}
	}
}

module.exports = Bot;
