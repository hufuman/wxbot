

const os = require('os');
const fs = require('fs');
const EventEmitter = require('events');
const WeChatBot = require('./wechat');


let event = new EventEmitter();
let options = {
	basePath: os.userInfo().homedir,
	event: event
}
let weChatBot = new WeChatBot(options);

event.on('qrcode', file => {
	console.log('qrcode file: ' + file);
	console.log('you need to open this file, and scan it use wechat to login.')
});

event.on('user', userInfo => {
	console.log('self info: ')
	console.dir(userInfo);
});

event.on('contact', contacts => {
	console.log('contact count is ' + contacts.length);
});

let count = 0;
event.on('msg', msgs => {
	msgs.forEach(msg => {
		if(msg.MsgType != 1)
			return;
		let userInfo = weChatBot.getUserByUserName(msg.FromUserName);
		let userName = msg.FromUserName;
		if(userInfo) {
			userName = userInfo.nickName;
			if(userInfo.isSelf)
				userName += `(Self)`;
		}
		console.log(`${userName}: `);
		console.log(`\t${msg.Content}`);
	});
});

weChatBot.login();
