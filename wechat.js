'use strict';

const fs = require('fs');
const url = require('url');
const path = require('path');
const https = require('https');
const async = require('async');
const events = require('events');
const superagent = require('superagent');


const wechatUrls = {
	uuidUrl: 'https://login.weixin.qq.com/jslogin?appid=wx782c26e4c19acffb&redirect_uri=https%3A%2F%2Fwx.qq.com%2Fcgi-bin%2Fmmwebwx-bin%2Fwebwxnewloginpage&fun=new&lang=zh_CN&_=1388994062250',
	qrcodeUrl: 'https://login.weixin.qq.com/qrcode/{uuid}?t=webwx',
	baseUrl: 'https://wx.qq.com/cgi-bin/mmwebwx-bin',
	statReportUrl: '/webwxstatreport?type=1&r=1455625522'
}


/**
 *
 *	events:
 *		qrcode, params: filePath
 *		user, param: this.selfInfo
 *		msg, param: [{FromUserName, Content, MsgType}]
 *		contact, param: [{userName, nickName, headImgUrl}]
 *
 */

class WeChatBot extends events{

	/**
	 *
	 * @param options - {basePath: ''}
	 *
	 */
	constructor(options) {
		super();
		this.basePath = options.basePath || './';
		this.redirectUri = '';
		this.baseUri = '';
		this.uuid = '';
		this.userAuth = {};
		this.selfInfo = {
			isSelf: true,
			userName: '',
			nickName: '',
			headImgUrl: ''
		};
		this.contactList = [];
	}

	/**
	 *
	 *
	 */
	login() {
		let self = this;
		async.series([
			// fetch uuid
			cb => self.fetchUuid(cb),
			// download qrcode
			cb => self.downloadQrcode(cb),
			// check scan
			cb => self.checkScan(cb),
			// fetch uin & sid & ticket etc.
			cb => self.fetchUserAuth(cb),
			// stat report
			cb => self.statReport(cb),
			// fetch user info
			cb => self.fetchUserInfo(cb),
			// get contacts
			cb => self.getContact(cb),
			// start fetch msg
			function(cb) {
				console.log('checking msg...');
				setInterval(self.fetchMsg.bind(self), 1000);
			}
		], function(err, results) {
			console.log('all done');
		});
	}

	/**
	 *
	 * @param callback - (err, ret_code), 0 for success
	 *
	 */
	sendTextMsg(toUserName, msg, callback) {
		let clientMsgId = new Date().valueOf() + Math.floor(Math.random() * 8999 + 100);
		let data = {
			BaseRequest: {
				Uin: this.userAuth.uin,
				Sid: this.userAuth.sid,
				Skey: this.userAuth.SKey,
				DeviceID: this.userAuth.deviceId
			},
			Msg: {
				Type: 1,
				Content: msg,
				FromUserName: this.selfInfo.userName,
				ToUserName: toUserName,
				LocalID: clientMsgId,
				ClientMsgId: clientMsgId
			}
		};
		let url = wechatUrls.baseUrl + '/webwxsendmsg?pass_ticket=' + this.userAuth.ticket;

		superagent.post(url)
			.set('Cookie', this.userAuth.cookie)
			.set('Content-Type', 'application/json')
			.set('Accept-Encoding', 'gzip')
			.send(JSON.stringify(data))
			.end(function(err, res) {
				let retCode = -1;
				let msg = null;
				if(!err) {
					if(res.text) {
						let response = JSON.parse(res.text);
						retCode = response.BaseResponse.Ret;
						msg = response.BaseResponse.ErrMsg;
						if(!msg && msg.length == 0)
							msg = null;
					}
				}
				callback(err || msg || (retCode == 0 ? null : 'retCode: ' + retCode), retCode);
			});
	}

	/**
	 *
	 * get user's name by userName
	 *
	 */
	getUserByUserName(userName) {
		if(userName === this.selfInfo.userName) {
			return this.selfInfo;
		}
		for(var i in this.contactList) {
			if(this.contactList[i].userName == userName) {
				return this.contactList[i];
			}
		}
		return null;
	}

	/**
	 * get uuid
	 */
	fetchUuid(cb) {
		let self = this;
		superagent.get(wechatUrls.uuidUrl)
			.set('Accept-Encoding', 'gzip')
			.end(function(err, res) {
				if(err) {
					console.log('fetchUuid error: ' + err);
					cb(err);
					return;
				}
				self.uuid = res.text.split('"')[1];
				console.log('uuid: ' + self.uuid);
				cb(null);
			});
	}

	/**
	 * download qrcode
	 */
	downloadQrcode(cb) {
		let self = this;
		let file = path.join(this.basePath, 'qrcode.png');
		superagent
			.get(wechatUrls.qrcodeUrl.replace('{uuid}', self.uuid))
			.on('end', function(err) {
				console.log('qrcode download ' + (err ? 'failed' : 'success'));
				if(!err)
					self.emit('qrcode', file);
				cb(err);
			})
			.pipe(fs.createWriteStream(file));
	}


	/**
	 *
	 * check whether qrcode is scanned
	 *
	 */
	checkScan(cb) {
		let self = this;
		let loginReported = false;
		superagent.get('https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login?uuid={uuid}&tip=1&_='.replace('{uuid}', this.uuid))
			.set('Accept-Encoding', 'gzip')
			.end(function(err, res) {
				if(!loginReported && res.text.indexOf('window.redirect_uri') > 0) {
					self.redirectUri = res.text.split('"')[1];
					self.baseUri = self.redirectUri.substring(0, self.redirectUri.lastIndexOf("/"))
					console.log('redirectUri: ' + self.redirectUri);
					cb(null);
					return;
				} else if(!loginReported && res.text.indexOf('window.code=201;')) {
					superagent.post(wechatUrls.baseUrl + '/webwxstatreport?type=1&r=1455625520')
						.set('Accept-Encoding', 'gzip')
						.send('{"BaseRequest":{"Uin":0,"Sid":0},"Count":1,"List":[{"Type":1,"Text":"/cgi-bin/mmwebwx-bin/login, First Request Success, uuid: ' + self.uuid + '"}]}')
						.end();
					superagent.post(wechatUrls.baseUrl + '/webwxstatreport?type=1&r=1455625520')
						.set('Accept-Encoding', 'gzip')
						.send('{"BaseRequest":{"Uin":0,"Sid":0},"Count":1,"List":[{"Type":1,"Text":"/cgi-bin/mmwebwx-bin/login, Second Request Success, uuid: ' + self.uuid + '"}]}')
						.end();
					loginReported = true;
					console.log('logging...');
				}

				setTimeout(function(){self.checkScan(cb)}, 200);
				console.log('checking...');
		});
	}


	/**
	 *
	 * fetch uin & sid & ticket etc.
	 *
	 *
	 */
	fetchUserAuth(cb) {
		let urlData = url.parse(this.redirectUri);
		let options = {
			host: urlData.host,
			port: urlData.port,
			path: urlData.path + '&func=new',
			protocol: urlData.protocol,
			method: 'GET'
		};
		let self = this;
		https.request(options, function(res) {
			if(res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
				let cookies = res.headers['set-cookie'].join(';');
				self.userAuth.uin = cookies.match(/wxuin=.+?;/)[0].split(/[=;]/)[1];
				self.userAuth.ticket = cookies.match(/webwx_data_ticket=.+?;/)[0].split(/[=;]/)[1];
				self.userAuth.sid = cookies.match(/wxsid=.+?;/)[0].split(/[=;]/)[1];
				self.userAuth.loadtime = cookies.match(/wxloadtime=.+?;/)[0].split(/[=;]/)[1];
				self.userAuth.uvid = cookies.match(/webwxuvid=.+?;/)[0].split(/[=;]/)[1];
				self.userAuth.lang = cookies.match(/mm_lang=.+?;/)[0].split(/[=;]/)[1];
				self.userAuth.cookie = 'wxuin=' + self.userAuth.uin + '; wxsid=' + self.userAuth.sid + '; wxloadtime=' + self.userAuth.loadtime + '; mm_lang=' + self.userAuth.lang + '; webwx_data_ticket=' + self.userAuth.ticket + '; webwxuvid=' + self.userAuth.uvid;
				console.log('userAuth loaded');
				// superagent.saveCookies(res);
				cb(null);
			} else {
				let msg = 'fetch user auth failed, status: ' + res.statusCode;
				console.log(msg);
				cb(msg)
			}
		}).on('error', function(err) {
			console.log('fetch user auth failed: ' + err);
			cb(err);
		}).end();
	}

	/**
	 *
	 * stat report
	 */	
	statReport(cb) {
		superagent.post(wechatUrls.statReportUrl)
			.set('Cookie', this.userAuth.cookie)
			.send('{"BaseRequest":{"Uin":0,"Sid":0},"Count":1,"List":[{"Type":1,"Text":"/cgi-bin/mmwebwx-bin/login, Second Request Success, uuid: {uuid}, time: 190765ms"}]}'.replace('{uuid}', this.uuid))
			.end(function(err, res) {
				cb(null);
			});
	}

	/**
	 *
	 * fetch user's info and sKey
	 *
	 *
	 */	
	fetchUserInfo(cb) {
		let initUrl = this.baseUri + '/webwxinit?pass_ticket=' + this.userAuth.ticket + '&r=1455625522';
		let body = '{"BaseRequest":{"Uin":"{uin}","Sid":"{sid}","Skey":"","DeviceID":"{deviceId}"}}'
			.replace('{uin}', this.userAuth.uin)
			.replace('{sid}', this.userAuth.sid)
			.replace('{deviceId}', this.userAuth.deviceId);
		let self = this;
		superagent.post(initUrl)
			.set('Cookie', self.userAuth.cookie)
			.set('Accept-Encoding', 'gzip')
			.send(body)
			.end(function(err, res) {
				if(!err && res.text) {
					var data = JSON.parse(res.text);
					self.selfInfo.userName = data.User.UserName;
					self.selfInfo.nickName = data.User.NickName;
					self.selfInfo.headImgUrl = data.User.HeadImgUrl;
					self.userAuth.SKey = data.SKey;
					self.userAuth.SyncKey = data.SyncKey;
					self.emit('user', self.selfInfo);
				}

				cb(err);
			});
	}

	/**
	 *
	 * fetch contact info
	 *
	 *
	 *
	 */
	getContact (cb) {
		let url = this.baseUri + `/webwxgetcontact?lang=zh_CN&pass_ticket=${this.userAuth.ticket}&seq=0&skey=${this.userAuth.SKey}&r=1455625522`;

		let self = this;
		superagent.get(url)
			.set('Cookie', self.userAuth.cookie)
			.set('Accept-Encoding', 'gzip')
			.end(function(err, res) {
				if(!err && res.text) {
					var memberList = JSON.parse(res.text).MemberList;
					for(var i in memberList) {
						let m = memberList[i];
						var d = {
							userName: m.UserName,
							nickName: m.NickName,
							alias: m.Alias,
							headImgUrl: m.HeadImgUrl,
							_raw: m
						};
						self.contactList.push(d);
					}
					self.emit('contact', self.contactList);
				}
				cb(err);
			});
	}

	/**
	 *
	 * fetch msgs
	 *
	 *
	 */
	fetchMsg() {
		let self = this;
		let url = 'https://webpush.weixin.qq.com/cgi-bin/mmwebwx-bin/synccheck?skey'
			+ this.userAuth.SKey + '&callback=jQuery183084135492448695_1420782130686&r=' + (new Date()).valueOf()
			+ '&sid=' + this.userAuth.sid
			+ '&uin=' + this.userAuth.uin
			+ '&deviceid=' + this.userAuth.deviceid
			+ '&synckey' + this.getSyncKey();
		superagent.get(url)
			.set('Cookie', this.userAuth.cookie)
			.set('Accept-Encoding', 'gzip')
			.end(function(err, res) {
				if(!err) {
					if(res.text.indexOf('selector:"0"') < 0) {
						// new msg
						self.fetchMsgContent();
					}
				} else {
					console.log('fetchMsg failed: ' + err);
				}
			});
	}

	/**
	 *
	 * get sync key
	 *
	 */
	getSyncKey() {
		let result = '';
		for(let key in this.userAuth.SyncKey.List) {
			result += key.Key + '_' + key.Val + '%7C';
		}
		result = result.substring(0, result.length - 3);
		return result;
	}

	/**
	 *
	 * fetch msg content
	 *
	 *
	 */
	fetchMsgContent() {
		let self = this;
		let url = wechatUrls.baseUrl + '/webwxsync?sid=' + this.userAuth.sid + '&skey=' + this.userAuth.SKey + '&r=' + (new Date()).valueOf();
		superagent.post(url)
			.set('Cookie', this.userAuth.cookie)
			.set('Accept-Encoding', 'gzip')
			.send({
				BaseRequest: {
					Uin: self.userAuth.uin,
					Sid: self.userAuth.sid,
				},
				SyncKey: self.userAuth.SyncKey,
				rr: (new Date()).valueOf()
			})
			.end(function(err, res) {
				if(err || !res.text) {
					console.log('fetch msg content failed: ' + err);
				} else {
					var data = JSON.parse(res.text);
					if(data.AddMsgCount <= 0)
						return;
					if(data.SyncKey.Count > 0)
						self.userAuth.SyncKey = data.SyncKey;
					if(data && data.AddMsgList && data.AddMsgList.length > 0) {
						data.AddMsgList.forEach(msg => {
							let userInfo = self.getUserByUserName(msg.FromUserName);
							self.emit('msg', userInfo, msg);
						});
					}
				}
			});
	}
}

module.exports = WeChatBot;























