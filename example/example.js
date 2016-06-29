
const os = require('os');
const fs = require('fs');
const path = require('path');
const WeChatBot = require('../wechat');


let options = {
	// path to downloda qrcode image
	basePath: path.join(os.userInfo().homedir, 'Desktop')
}
let weChatBot = new WeChatBot(options);

/**
 *
 * after downloaded qrcode image
 *
 */
weChatBot.on('qrcode', file => {
	console.log('qrcode file: ' + file);
	console.log('you need to open this file, and scan it use wechat to login.')
});

/**
 *
 * after fetched current user's information
 *
 *
 */
weChatBot.on('user', userInfo => {
	console.log('self info: ')
	console.dir(userInfo);
});

/**
 *
 * after fetched contact list
 *
 *
 */
weChatBot.on('contact', contacts => {
	console.log('contact count is ' + contacts.length);
});

/**
 *
 * after msg arrived
 *
 *
 */
weChatBot.on('msg', (sender, msg) => {
	if(msg.MsgType != 1)
		return;
	let userName = msg.FromUserName;
	if(sender) {
		userName = sender.nickName + (sender.isSelf ? '(Self)' : '');
	}
	console.log(`${userName}: \n\t${msg.Content}`);
	if(msg.Content.indexOf('test') >= 0) {
		// send hello wolrd to sender
		weChatBot.sendTextMsg(sender.userName, 'hello world', (err, retCode) => {
			console.log('send msg ' + (err ? err : ' success.'));
		});
	}
});

/**
 *
 * login after setuped event listeners
 *
 */
weChatBot.login();

