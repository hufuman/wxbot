'use strict';

const fs = require('fs');
const url = require('url');
const path = require('path');
const https = require('https');
const async = require('async');
const events = require('events');
const superagent = require('superagent');



const wechatUrls = {
	uuidUrl: 'https://login.wx.qq.com/jslogin?appid=wx782c26e4c19acffb&redirect_uri=https%3A%2F%2Fwx.qq.com%2Fcgi-bin%2Fmmwebwx-bin%2Fwebwxnewloginpage&fun=new&lang=zh_CN&_=',
	qrcodeUrl: 'https://login.weixin.qq.com/qrcode/{uuid}?t=webwx',
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

	getTimestamp() {
		return ("" + Math.random().toFixed(15)).substring(2, 17);
	}

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
		this.userAuth = {
			deviceId: "e" + this.getTimestamp()
		};
		this.emit('deviceId', {deviceId: this.userAuth.deviceId});
		this.selfInfo = {
			isSelf: true,
			userName: '',
			nickName: '',
			remarkName: '',
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
			// check login
			cb => self.checkLogin(cb),
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
				self.fetchMsg(cb);
			}
		], function(err, results) {
			if(err) {
				console.error('error: ' + err);
			}
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
		let url = this.baseUri + '/webwxsendmsg?pass_ticket=' + this.userAuth.ticket;

		this.postJson(url, data, (err, responseJson) => {
			let retCode = -1;
			let msg = null;
			if(responseJson) {
				retCode = responseJson.BaseResponse.Ret;
				msg = responseJson.BaseResponse.ErrMsg;
				if(!msg && msg.length == 0)
					msg = null;
			}
			callback(err || msg || (retCode == 0 ? null : 'retCode: ' + retCode), retCode);
		});
	}

	/**
	 *
	 * get user by alias/nickName/remarkName
	 *
	 */
	getUserByName(name) {
		if(name === this.selfInfo.alias || name === this.selfInfo.nickName || name === this.selfInfo.remarkName) {
			return this.selfInfo;
		}
		let users = this.contactList.filter(d => name === d.alias || name === d.nickName || name === d.remarkName);
		if(users.length === 0)
			return null;
		return users[0];
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
		this.getString(wechatUrls.uuidUrl + this.getTimestamp(), (err, text) => {
			if(!err) {
				self.uuid = text.split('"')[1];
				self.emit('uuid', {uuid: self.uuid});
			}
			cb(err);
		});
	}

	/**
	 * download qrcode
	 */
	downloadQrcode(cb) {
		let self = this;
		let file = path.join(this.basePath, 'qrcode.png');
		let stream = fs.createWriteStream(file);
		stream.on('close', () => {
			console.log('qrcode download success');
			self.emit('qrcode', {file: file});
			if(cb) {
				cb(null);
				cb = null;
			}
		});
		superagent
			.get(wechatUrls.qrcodeUrl.replace('{uuid}', self.uuid))
			.on('end', function(err) {
				if(cb) {
					cb(err);
					cb = null;
				}
			})
			.pipe(stream);
	}


	/**
	 *
	 * check whether qrcode is scanned
	 *
	 */
	checkScan(cb) {
		let self = this;
		console.log('checking...');
		let url = ('https://login.wx.qq.com/cgi-bin/mmwebwx-bin/login?loginicon=false&uuid={uuid}&tip=0&_=' + this.getTimestamp()).replace('{uuid}', this.uuid);
		this.getString(url, (err, text) => {
			if(!err && text && text.indexOf('window.code=201;') >= 0) {
				cb(null);
			} else {
				setTimeout(function(){self.checkScan(cb)}, 200);
			}
		});
	}

	/**
	 * check if user click 'login' button
	 *
	 *
	 */
	checkLogin(cb) {
		let self = this;
		console.log('logining...');
		let url = ('https://login.wx.qq.com/cgi-bin/mmwebwx-bin/login?uuid={uuid}&tip=1&_=' + this.getTimestamp()).replace('{uuid}', this.uuid);
		this.getString(url, (err, text) => {
			if(!err && text && text.indexOf('window.code=200;') >= 0 && text.indexOf('window.redirect_uri') >= 0) {
				self.redirectUri = text.split('"')[1];
				self.baseUri = self.redirectUri.substring(0, self.redirectUri.lastIndexOf("/"));
				self.emit('login', {});
				cb(null);
			} else {
				setTimeout(function(){self.checkLogin(cb)}, 200);
			}
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
		this.postJson(initUrl, body, (err, responseJson) => {
			if(responseJson) {
				self.selfInfo = self.parseUserInfo(responseJson.User);
				self.emit('selfInfo', {selfInfo: self.selfInfo});
				self.userAuth.SKey = responseJson.SKey;
				self.resetSyncKey(responseJson.SyncKey);
			}
			cb(err);
		});
	}

	/**
	 *
	 *
	 *
	 */
	resetSyncKey(syncKey) {
		if(!syncKey)
			return;
		if((+syncKey.Count) <= 0)
			return;
		if(!syncKey.List || syncKey.List.length <= 0)
			return;
		this.userAuth.SyncKey = syncKey;
		this.flatSyncKey = '';
		for(let item of syncKey.List) {
			this.flatSyncKey += item.Key + '_' + item.Val + '%7C';
		}
		this.flatSyncKey = this.flatSyncKey.substring(0, this.flatSyncKey.length - 3);
	}

	/**
	 * parse uesr info in json object
	 *
	 *
	 *
	 */
	parseUserInfo(userObj) {
		let userInfo = {
		    userName: userObj.UserName,
		    nickName: userObj.NickName,
		    displayName: userObj.DisplayName,
		    remarkName: userObj.RemarkName,
		    contactFlag: userObj.ContactFlag,
		    sex: userObj.Sex,
		    signature: userObj.Signature,

		    searchPinyins: userObj.KeyWord + '|'
		        + userObj.PYInitia + '|'
		        + userObj.PYQuanPin + '|'
		        + userObj.RemarkPYInitial + '|'
		        + userObj.RemarkPYQuanPin + '|',

		    headImgUrl: 'https://wx.qq.com' + userObj.HeadImgUrl
		};
		return userInfo;
	}

	/**
	 *
	 * fetch contact info
	 *
	 *
	 *
	 */
	getContact (cb) {
		let url = this.baseUri + `/webwxgetcontact?lang=zh_CN&pass_ticket=${this.userAuth.ticket}&seq=0&skey=${this.userAuth.SKey}&r=` + this.getTimestamp();

		let self = this;
		this.getString(url, (err, text) => {
			if(err) {
				setTimeout(self.getContact.bind(self), 500);
			} else {
				var memberList = JSON.parse(text).MemberList;
				for(var i in memberList) {
					var d = self.parseUserInfo(memberList[i]);
					self.contactList.push(d);
				}
				self.emit('contacts', {contacts: self.contactList});
				cb(null);
			}
		});
	}

	/**
	 *
	 * fetch msgs
	 *
	 *
	 */
	fetchMsg(cb) {
		let self = this;
		let url = 'https://webpush.weixin.qq.com/cgi-bin/mmwebwx-bin/synccheck?skey='
			+ this.userAuth.SKey + '&callback=jQuery183084135492448695_1420782130686&r=' + this.getTimestamp()
			+ '&sid=' + this.userAuth.sid
			+ '&uin=' + this.userAuth.uin
			+ '&deviceid=' + this.userAuth.deviceId
			+ '&synckey=' + this.flatSyncKey;

		this.getString(url, (err, text) => {
			if(err) {
				console.log('fetchMsg error');
				console.dir(err);
				setTimeout(self.fetchMsg.bind(self), 500);
				return;
			}
			let needToFetchMsg = true;
			if(text.indexOf('window.synccheck=') == 0) {
				needToFetchMsg = false;
				let retCode = +text.split('retcode:"')[1].split('"')[0];
				let selector = +text.split('selector:"')[1].split('"')[0];
				if(retCode === 0 && selector != 0) {
					self.fetchMsgContent(() => {
						self.fetchMsg();
					});
				} else if(retCode == 1100) {
					console.log('text: ' + text);
					console.log('retCode: ' + retCode + ', selector: ' + selector);
					self.emit('logout', {reason: 'app_exited'});
				} else if(retCode == 1101) {
					console.log('text: ' + text);
					console.log('retCode: ' + retCode + ', selector: ' + selector);
					self.emit('logout', {reason: 'other_login'});
				} else {
					needToFetchMsg = true;
				}
			}
			if(needToFetchMsg) {
				setTimeout(self.fetchMsg.bind(self), 500);
			}
		});
	}


	/**
	 *
	 * fetch msg content
	 *
	 *
	 */
	fetchMsgContent(cb) {
		let self = this;
		let url = this.baseUri + '/webwxsync?sid=' + this.userAuth.sid + '&lang=zh_CN&skey=' + this.userAuth.SKey + '&r=' + this.getTimestamp() + '&pass_ticket=' + this.userAuth.ticket;
		let data = {
			BaseRequest: {
				Uin: self.userAuth.uin,
				Sid: self.userAuth.sid,
				Skey: self.userAuth.SKey
			},
			SyncKey: self.userAuth.SyncKey,
			rr: this.getTimestamp()
		};
		this.postJson(url, data, (err, responseJson) => {
			if(!err) {
				self.resetSyncKey(responseJson.SyncKey);
				if(responseJson && responseJson.AddMsgCount > 0 && responseJson.AddMsgList && responseJson.AddMsgList.length > 0) {
					responseJson.AddMsgList.forEach(msg => {
						let userInfo = self.getUserByUserName(msg.FromUserName);
						self.emit('msg', {from: userInfo, msg: msg});
					});
				}
			}
			cb();
		});
	}

	getString(url, callback) {
		let self = this;
		superagent.get(url)
			.set('Cookie', this.userAuth.cookie || '')
			.set('Accept-Encoding', 'gzip')
			.set('Content-Type', 'application/json')
			.end(function(err, res) {
				let text = null;
				if(err) {
					console.log('network error: ' + err);
				} else if(!res || !res.text) {
					err = 'empty response';
					console.log('empty response');
				} else {
					text = res.text;
				}
				callback(err, text);
			});
	}

	postJson(url, data, callback) {
		let self = this;
		superagent.post(url)
			.set('Cookie', this.userAuth.cookie)
			.set('Accept-Encoding', 'gzip')
			.set('Content-Type', 'application/json')
			.send(data)
			.end(function(err, res) {
				let responseJson = null;
				if(err) {
					console.log('network error: ' + err);
				} else if(!res || !res.text) {
					err = 'empty response';
					console.log('empty response');
				} else {
					responseJson = JSON.parse(res.text);
				}
				callback(err, responseJson);
			});
	}
}

module.exports = WeChatBot;























