
const os = require('os');
const fs = require('fs');
const path = require('path');
const WeChatBot = require('../../wechat');

const reload = require('require-reload')(require);

// init weChatBot
let options = {
	basePath: path.join(os.userInfo().homedir, 'Desktop')
}
let weChatBot = new WeChatBot(options);

// hot-reload bot.js
let Bot = reload('./bot');
let bot = new Bot(weChatBot);
let reloading = false;
fs.watch('./bot.js', () => {
	if(reloading)
		return;
	reloading = true;
	setTimeout(() => {
		try {
			Bot = reload('./bot');
			bot = new Bot(weChatBot);
			console.log('bot reloaded');
		} catch (e) {
			console.log('bot reload failed: ' + e);
		}
		reloading = false;
	}, 500);
});

// notify user to scan qrcode
weChatBot.on('qrcode', file => {
	console.log('qrcode file: ' + file);
	console.log('you need to open this file, and scan it use wechat to login.')
});

// msg received
weChatBot.on('msg', (sender, msg) => {
	if(msg.MsgType != 1)
		return;
	let userName = msg.FromUserName;
	if(sender) {
		userName = sender.nickName + (sender.isSelf ? '(Self)' : '');
	}
	bot.onMsg(userName, msg, sender);
});

// start to login
weChatBot.login();

