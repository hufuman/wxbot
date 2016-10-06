
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
weChatBot.on('qrcode', args => {
	console.log('qrcode file: ' + args.file);
	console.log('you need to open this file, and scan it use wechat to login.');
});

/**
 *
 * after fetched current user's information
 *
 *
 */
weChatBot.on('selfInfo', args => {
	console.log('self info: ')
	console.dir(args.selfInfo);
});

/**
 *
 * after fetched contact list
 *
 *
 */
weChatBot.on('contacts', args => {
	console.log('contact count is ' + args.contacts.length);
});

/**
 *
 * after msg arrived
 *
 *
 */
weChatBot.on('msg', args => {
	let sender = args.from;
	let msg = args.msg;
	if(msg.MsgType != 1)
		return;
	let userName = msg.FromUserName;
	if(sender) {
		userName = sender.nickName + (sender.isSelf ? '(Self)' : '');
	}
	console.log(`${userName}: \n\t${msg.Content}`);
	if(msg.Content.indexOf('hello') >= 0) {
		// send hello wolrd to sender
		weChatBot.sendTextMsg(sender.userName, 'hello bot', (err, retCode) => {
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

