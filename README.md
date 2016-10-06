# wxbotjs - bot for wechat

nodejs implementation for wechat bot

[wechat](http://weixin.qq.com/) is a popular IM made by Tencent.

wxbotjs aims to provide a simple way to implement a weichat bot.

### INSTALLATION

```
npm install wxbotjs
```

## USAGE

### [example.js](./example/example.js)
display text messages and reply 'hello bot' to people who sends 'hello'

### [hot reload example](./example/hot-reload)

it's very useful to reload bot.js while developing bot.

***note:***

hot-reload depends on [require-reload](https://www.npmjs.com/package/reload-require)

### Events
	1. deviceId, {deviceId: ''}
	2. uuid, {uuid: ''}
	3. qrcode, {file: ''}
	4. login
	5. selfInfo, {selfInfo: {
		userName,
		nickName,
		displayName,
		remarkNamek,
		contactFlag,
		sex,
		signature,
		searchPinyins,
		headImgUrl
	}}
	6. contacts, {contacts: []}
	7. msg, {from: userInfo, msg: msg}
	8. logout, {reason: ''}

### TODO

1. Reload bot while bot is running
2. Send file
3. Send image

### NOTE
Thanks to [Weixinbot](https://github.com/hufuman/WeixinBot).

