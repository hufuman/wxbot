# wxbotjs - bot for wechat

nodejs implementation for wechat bot

[wechat](http://weixin.qq.com/) is a popular IM made by Tencent.

wxbotjs aims to provide a simple way to implement a weichat bot.

### INSTALLATION

```
npm install wxbotjs
```

## USAGE

***[example.js](./example/example.js)***

```
const WeChatBot = require('wechat');

let options = {
	// path to downloda qrcode image
	basePath: path.join(os.userInfo().homedir, 'Desktop')
}
let weChatBot = new WeChatBot(options);

// event when qrcode image downloaded
// now you should scan the image using Wechat app
weChatBot.on('qrcode', file => {
	console.log('qrcode file: ' + file);
	console.log('you need to open this file, and scan it use wechat to login.')
});

// event when msg received
weChatBot.on('msg', (sender, msg) => {
	if(msg.MsgType != 1)
		return;
	let userName = msg.FromUserName;
	if(sender) {
		userName = sender.nickName + (sender.isSelf ? '(Self)' : '');
	}
	console.log(`${userName}: \n\t${msg.Content}`);
	if(msg.Content.indexOf('test') >= 0) {
		// send response to sender
		weChatBot.sendTextMsg(sender.userName, 'hello world', (err, retCode) => {
			console.log('send msg ' + (err ? err : ' success.'));
		});
	}
});

```

***[hot reload example](./example/hot-reload)***

it's very useful to reload bot.js while developing bot.

***note:***

hot-reload depends on [require-reload](https://www.npmjs.com/package/reload-require)

### TODO

1. Reload bot while bot is running
2. Send file
3. Send image

### NOTE
Thanks to [Weixinbot](https://github.com/hufuman/WeixinBot).

