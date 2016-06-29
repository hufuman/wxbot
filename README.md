# wxbot - bot for wechat

nodejs implementation for wechat bot

[wechat](http://weixin.qq.com/) is a popular IM made by Tencent.

wxbot aims to provide a simple way to implement a weichat bot.

### INSTALLATION

```
npm install wxbot
```

## USAGE

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
});

```

### NOTE
Thanks to [Weixinbot](https://github.com/hufuman/WeixinBot).

