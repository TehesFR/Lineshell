module.exports = function(app, passport) {

	// AES encrytpion functions ===============================================================
	var crypto = require('crypto'),
    algorithm = 'aes-256-ctr',
    password = 'l0up64bvp64b4RsDolfg9X81qGpvqBCm';

	function encrypt(text){
	  var cipher = crypto.createCipher(algorithm,password)
	  var crypted = cipher.update(text,'utf8','hex')
	  crypted += cipher.final('hex');
	  return crypted;
	}

	function decrypt(text){
	  var decipher = crypto.createDecipher(algorithm,password)
	  var dec = decipher.update(text,'hex','utf8')
	  dec += decipher.final('utf8');
	  return dec;
	}

	// show the home page (will also have our login links)
	app.get('/', function(req, res) {
		res.render('index.ejs');
	});

	// ERROR PAGE
	app.get('/error', function(req, res) {
		res.render('error.ejs');
	});

	var base32 = require('thirty-two')
		  , utils = require('./utils')
		  , LocalStrategy = require('passport-local').Strategy
			, TotpStrategy = require('passport-totp').Strategy

	function findKeyForUserId(id, fn) {

		var User                       = require('../app/models/user');
		User.findById(id, function (err, user){
			return fn(null, user.gauth.key);
		});
	}

	function saveKeyForUserId(id, key, fn) {

		var User                       = require('../app/models/user');
		User.findById(id, function (err, user){
			user.gauth.key               = key;
					user.save(function(err, user) {
						if (err){
									console.log(err);
						}
					});
	});
		return fn(null);
	}

	function ensureSecondFactor(req, res, next) {
	  if ((req.session.secondFactor == 'totp') || (!req.user.gauth.activated)) { return next(); }
	  res.redirect('/login')
	}

	// SETUP 2 FACTOR AUTHENTICATION
	app.post('/setup2fa', isLoggedIn, ensureSecondFactor, function(req, res, next){
  findKeyForUserId(req.user.id, function(err, obj) {
    if (err) { return next(err); }
    if (obj) {
      // two-factor auth has already been setup
      var encodedKey = base32.encode(obj.key);

      // generate QR code for scanning into Google Authenticator
      // reference: https://code.google.com/p/google-authenticator/wiki/KeyUriFormat
      var otpUrl = 'otpauth://totp/' + req.user.local.email
                 + '?secret=' + encodedKey + '&period=' + (obj.period || 30)  + '&issuer=Lineshell';
      var qrImage = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(otpUrl);

      res.render('setup2fa.ejs', { user: req.user, key: encodedKey, qrImage: qrImage });
    } else {
      // new two-factor setup.  generate and save a secret key
      var key = utils.randomKey(10);
      var encodedKey = base32.encode(key);

      // generate QR code for scanning into Google Authenticator
      // reference: https://code.google.com/p/google-authenticator/wiki/KeyUriFormat
      var otpUrl = 'otpauth://totp/' + req.user.local.email
                 + '?secret=' + encodedKey + '&period=30' + '&issuer=Lineshell';
      var qrImage = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(otpUrl);

      saveKeyForUserId(req.user.id, { key: key, period: 30 }, function(err) {
        if (err) { return next(err); }
        res.render('setup2fa.ejs', { user: req.user, key: encodedKey, qrImage: qrImage });
      });
    }
  });
});

passport.use(new TotpStrategy(
  function(user, done) {
    // setup function, supply key and period to done callback
    findKeyForUserId(user.id, function(err, obj) {
      if (err) { return done(err); }
      return done(null, obj.key, obj.period);
    });
  }
));

app.post('/verif2fa', isLoggedIn, passport.authenticate('totp', { failureRedirect: '/error', failureFlash: true }),
  function(req, res) {
		req.session.secondFactor = 'totp';
		var User                 = require('../app/models/user');
		User.findById(req.user._id, function (err, user){
			user.gauth.activated   = true;
					user.save(function(err, user) {
						if (err){
									console.log(err);
						}
					});
	});
	//RENDER TO SETTINGS
	var fse       = require('fs-extra')
	var publicKey = './__ssh_keys/' + req.user._id + '/id_rsa.pub';

	var User      = require('../app/models/user');
	var moment    = require('moment-timezone');
	var timezone  = req.user.settings.timezone;

			fse.readFile(publicKey, 'utf8', function(err, pubKey) {

				res.render('settings.ejs', {
					user : req.user,
					pubKey : pubKey,
					moment : moment,
					timezone : timezone,
					message : "activated",
					gauth : true
				});
			})
  });

	// DISABLE 2 FACTOR AUTHENTICATION
	app.post('/disable2fa', isLoggedIn, ensureSecondFactor, function(req, res, next){
		var User                 = require('../app/models/user');
		User.findById(req.user._id, function (err, user){
			user.gauth.activated   = false;
					user.save(function(err, user) {
						if (err){
									console.log(err);
						}
					});
		});
		//RENDER TO SETTINGS
		var fse       = require('fs-extra')
		var publicKey = './__ssh_keys/' + req.user._id + '/id_rsa.pub';

		var User      = require('../app/models/user');
		var moment    = require('moment-timezone');
		var timezone  = req.user.settings.timezone;

				fse.readFile(publicKey, 'utf8', function(err, pubKey) {

					res.render('settings.ejs', {
						user : req.user,
						pubKey : pubKey,
						moment : moment,
						timezone : timezone,
						message : "disabled",
						gauth : false
					});
				})
	});

	// GET LOGIN OTP PAGE
	app.get('/login-otp', isLoggedIn, function(req, res) {
		res.render('login-otp.ejs', {user : req.user});
	});

	// POST LOGIN OTP PAGE
	app.post('/login-otp', isLoggedIn, passport.authenticate('totp', { failureRedirect: '/login', failureFlash: true }),
	  function(req, res) {
			req.session.secondFactor = 'totp';
	    res.redirect('/dashboard');
	  });

	// PROFILE SECTION =========================
	app.get('/profile', isLoggedIn, ensureSecondFactor, function(req, res) {

		var moment    = require('moment-timezone');
		var timezone  = req.user.settings.timezone;

		res.render('profile.ejs', {
			user : req.user,
			moment : moment,
			timezone : timezone,
			error: req.session.error
		});
		if (req.session.error != undefined){
			delete req.session.error;
		};
	});

	// SETTINGS SECTION =========================
	app.get('/settings', isLoggedIn, ensureSecondFactor, function(req, res) {

		var fse       = require('fs-extra')
		var publicKey = './__ssh_keys/' + req.user._id + '/id_rsa.pub';

		var User      = require('../app/models/user');
		var moment    = require('moment-timezone');
		var timezone  = req.user.settings.timezone;

		User.findById(req.user._id, function (err, user){
			var gauth = user.gauth.activated;


			fse.readFile(publicKey, 'utf8', function(err, pubKey) {

				res.render('settings.ejs', {
					user : req.user,
					pubKey : pubKey,
					moment : moment,
					timezone : timezone,
					message : undefined,
					gauth : gauth
				});
			})
		});
	});

	// REFRESH SERVER STATUS =========================
	app.post('/refreshstatus', isLoggedIn, ensureSecondFactor, function(req, res) {

		if (req.user.keys.created_at != undefined){

		  var Server         = require('../app/models/server');

			var serverId       = req.body.serverId;
			var serverIp       = req.body.serverIp;
			var serverPort     = req.body.serverPort;
			var serverUsername = req.body.serverUsername;
			var userId         = req.user._id;

			var Connection     = require('ssh2');
			var conn           = new Connection();

			conn.on('ready', function() {
			  	console.log('Connection :: ready');
			  	conn.exec('uptime', function(err, stream) {
				    if (err) throw err;
				    stream.on('exit', function(code, signal) {
				      console.log('Stream :: exit :: code: ' + code + ', signal: ' + signal);
				    }).on('close', function() {
				      console.log('Stream :: close');
				      conn.end();
				    }).on('data', function(data) {
				      console.log('STDOUT: ' + data);
				      if(data != undefined){
			      		Server.findById(serverId, function (err, server){
									server.serverDetails.sshStatus   = true;

						    	server.save(function(err, server) {
										if (err){
												console.log(err);
												if(res.headersSent == false){res.render('error.ejs');}
									  }
					            res.redirect('/servers');
					        });
			 					});
			      }
				    }).stderr.on('data', function(data) {
				      console.log('STDERR: ' + data);
				    });
			  	});
			}).connect({
			  host: serverIp,
			  port: serverPort,
			  username: serverUsername,
			  privateKey: require('fs').readFileSync('./__ssh_keys/' + userId +'/id_rsa')
			});

			conn.on('error', function(e) { console.log("Connection failed or timed out");

				Server.findById(serverId, function (err, server){
						server.serverDetails.sshStatus   = false;

						    server.save(function(err, server) {
									if (err){
											console.log(err);
											if(res.headersSent == false){res.render('error.ejs');}
								  }
					            res.redirect('/servers');
					        });
			 	});
			 });
		}else{
			res.redirect('/settings');
		}
	 });


	// EXECUTE SCRIPT =========================
	app.get('/exec', isLoggedIn, ensureSecondFactor, function(req, res) {

		var customTimeout  = req.user.plan.timeout;

		res.setTimeout(customTimeout, function(){
			if(res.headersSent == false){
				res.render('exec-timeout.ejs', { user: req.user });
			}
		});

		var url = require('url');
		var url_parts = url.parse(req.url, true);
		var query = url_parts.query;

		var Server         = require('../app/models/server');
		var Execution      = require('../app/models/execution');
		var Script         = require('../app/models/script');
		var Group          = require('../app/models/group');
		var async          = require('async');
		var scriptId       = query.scriptId;
		var userId         = req.user._id;
		var serverId       = query.serverId;
		var groupId        = query.groupId;
		var selectedList   = query.selectedList;
		var withArgs       = query.withArgs;
		var args           = query.args;
		var nbargs         = query.nbargs;
		var arg            = query.arg;
		var notes          = query.notes;

		if (arg != undefined){
			var tabArgs      = arg.toString().split(",");
		}

		if(withArgs == "true" && args == "0"){ // script with arguments but not yet set by the user

			//build arguments tab
			async.parallel({
				scripts: function(callback){
						Script.findOne({$and:[{"_id" : scriptId}, {"scriptDetails.userId" : userId}]}).exec(callback);
				}
			}, function(err, results) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}

				var selectedScript = results.scripts;
				var scriptContent = selectedScript.scriptDetails.scriptContent;

				var reg = /(\{\{arg\:\$[a-zA-Z0-9_-]+\}\})/g; //regex to find {{arg:$}}
				var matches = [], found;

				while (found = reg.exec(scriptContent)) {
					matches.push(found[0]);
					reg.lastIndex -= found[0].split(':')[1].length;
				}

				// remove duplicate entries
				var unique = function(origArr) {
						var newArr = [],
								origLen = origArr.length,
								found,
								x, y;

						for ( x = 0; x < origLen; x++ ) {
								found = undefined;
								for ( y = 0; y < newArr.length; y++ ) {
										if ( origArr[x] === newArr[y] ) {
											found = true;
											break;
										}
								}
								if ( !found) newArr.push( origArr[x] );
						}
					return newArr;
				}

				matches = unique(matches);

				res.render('exec-with-args.ejs', {
					scriptId: scriptId,
					userId: userId,
					serverId: serverId,
					groupId: groupId,
					selectedList : selectedList,
					matches : matches,
					notes : notes,
					user : req.user
				});
			});
		}

		if(withArgs == "false" || args == "1"){ // script with no arguments or arguments already set by the user

		// IF RUN ON SINGLE SERVER
				if (selectedList == "servers"){

					var beginDate    = new Date();

					var tab_stdout   = new Array();
					var tab_stderr   = new Array();
					var tab_servname = new Array();

					async.parallel({
						servers: function(callback){
							Server.findOne({$and:[{"_id" : serverId}, {"serverDetails.userId" : userId}]}).exec(callback);
						},
						scripts: function(callback){
							Script.findOne({$and:[{"_id" : scriptId}, {"scriptDetails.userId" : userId}]}).exec(callback);
						}
					}, function(err, results) {
						if (err){
									console.log(err);
									if(res.headersSent == false){res.render('error.ejs');}
						}

							var selectedServer = results.servers;
							var selectedScript = results.scripts;

							if (selectedServer == null){
								res.render('bad-request.ejs', {
									user : req.user
								});
							}else{

							var serverName     = selectedServer.serverDetails.serverName;
							var serverIp       = selectedServer.serverDetails.serverAddress;
							var serverPort     = selectedServer.serverDetails.serverPort;
							var serverUsername = selectedServer.serverDetails.serverUsername;
							var scriptContent  = selectedScript.scriptDetails.scriptContent;
							var scriptName     = selectedScript.scriptDetails.scriptName;

							//edit script content to add arguments values
							var reg = /(\{\{arg\:\$[a-zA-Z0-9_-]+\}\})/g; //regex to find {{arg:$}}
							var matches = [], found;

							while (found = reg.exec(scriptContent)) {
								matches.push(found[0]);
								reg.lastIndex -= found[0].split(':')[1].length;
							}

							// remove duplicate entries
							var unique = function(origArr) {
									var newArr = [],
											origLen = origArr.length,
											found,
											x, y;

									for ( x = 0; x < origLen; x++ ) {
											found = undefined;
											for ( y = 0; y < newArr.length; y++ ) {
													if ( origArr[x] === newArr[y] ) {
														found = true;
														break;
													}
											}
											if ( !found) newArr.push( origArr[x] );
									}
								return newArr;
							}

							matches = unique(matches);

							for (j=0; j<nbargs; j++){
								var find = matches[j];
								var reg = new RegExp(find,"g");
								scriptContent = scriptContent.split(find).join(tabArgs[j]);
							}

							var Connection   = require('ssh2');
							var conn         = new Connection();
							conn.on('ready', function() {
								//console.log('Connection :: ready');
								conn.exec(scriptContent, function(err, stream) {
									if (err) return res.send(err);
									var stdout = '',
											stderr = '';
									stream.on('exit', function(code, signal) {
										//console.log('Stream :: exit :: code: ' + code + ', signal: ' + signal);
									}).on('close', function() {
										//console.log('Stream :: close');
										conn.end();

										tab_stdout = stdout;
										tab_stderr = stderr;
										tab_servname = serverName;

										if(res.headersSent == false){
											//insert into DB
											var newExecution                              = new Execution();
											newExecution.executionDetails.userId          = userId;
											newExecution.executionDetails.scriptId        = scriptId;
											newExecution.executionDetails.scriptName      = scriptName;
											newExecution.executionDetails.serverId        = serverId;
											newExecution.executionDetails.serverName      = serverName;
											newExecution.executionDetails.groupId         = undefined;
											newExecution.executionDetails.groupName       = undefined;
											newExecution.executionDetails.executionStdout = tab_stdout;
											newExecution.executionDetails.executionStderr = tab_stderr;
											newExecution.executionDetails.executionServ   = tab_servname;
											var moment = require('moment');
											newExecution.executionDetails.created_at      = moment().format();
											newExecution.executionDetails.withArgs        = withArgs;
											newExecution.executionDetails.matches         = matches;
											newExecution.executionDetails.tabArgs         = tabArgs;
											newExecution.executionDetails.notes           = notes;
											newExecution.save(function(err, newExecution) {
												if (err){
															console.log(err);
															if(res.headersSent == false){res.render('error.ejs');}
												}
														//nothing
													});

											var endDate = new Date();
											var duration = (endDate - beginDate)/1000;

											res.render('exec-results.ejs', {
												stdout: tab_stdout,
												stderr: tab_stderr,
												serverName: tab_servname,
												duration: duration,
												matches : matches,
												tabArgs : tabArgs,
												withArgs : withArgs,
												notes : notes
											});
									  }
									}).on('data', function(data) {
										//console.log('STDOUT: \n' + data_dout);
										stdout = stdout + data;
										//console.log('MYSTDOUT: \n' + stdout);
									}).stderr.on('data', function(data) {
									//console.log('STDERR: \n' + data);
										stderr = stderr + data;
									});
								});
							}).connect({
								host: serverIp,
								port: serverPort,
								username: serverUsername,
								privateKey: require('fs').readFileSync('./__ssh_keys/' + userId +'/id_rsa')
							});

							conn.on('error', function(e) {
								//console.log("Connection failed or timed out");
								tab_servname = serverName;
								tab_stdout = "";
								tab_stderr = "Connection failed or timed : " + e;
								duration = "0.000";

								res.render('exec-results.ejs', {
									stdout: tab_stdout,
									stderr: tab_stderr,
									serverName: tab_servname,
									duration: duration,
									withArgs: withArgs,
									notes: notes
								});
							});
							} // end of else > you are not authorized
						});
				}

				// IF RUN ON GROUP OF SERVERS !!
				if (selectedList == "groups"){

					var beginDate    = new Date();

					var tab_stdout   = new Array();
					var tab_stderr   = new Array();
					var tab_servname = new Array();

					async.parallel({
						servers: function(callback){
							Server.find({$and:[{"serverDetails.serverGroups" : { $regex: new RegExp(groupId, "i")}, "serverDetails.userId" : userId}]}).exec(callback);
						},
						groups: function(callback){
							Group.findOne({$and:[{"_id" : groupId}, {"groupDetails.userId" : userId}]}).exec(callback);
						},
						scripts: function(callback){
							Script.findOne({$and:[{"_id" : scriptId}, {"scriptDetails.userId" : userId}]}).exec(callback);
						}
					}, function(err, results) {
						if (err){
									console.log(err);
									if(res.headersSent == false){res.render('error.ejs');}
						}

							var serversArray   = results.servers;
							var selectedScript = results.scripts;
							var selectedGroup  = results.groups;

							if (selectedScript == null || selectedGroup == null){
								res.render('bad-request.ejs', {
									user : req.user
								});
							}else{

							var scriptContent  = selectedScript.scriptDetails.scriptContent;
							var scriptName     = selectedScript.scriptDetails.scriptName;
							var groupName      = selectedGroup.groupDetails.groupName;

							//edit script content to add arguments values
							var reg = /(\{\{arg\:\$[a-zA-Z0-9_-]+\}\})/g; //regex to find {{arg:$}}
							var matches = [], found;

							while (found = reg.exec(scriptContent)) {
								matches.push(found[0]);
								reg.lastIndex -= found[0].split(':')[1].length;
							}

							// remove duplicate entries
							var unique = function(origArr) {
									var newArr = [],
											origLen = origArr.length,
											found,
											x, y;

									for ( x = 0; x < origLen; x++ ) {
											found = undefined;
											for ( y = 0; y < newArr.length; y++ ) {
													if ( origArr[x] === newArr[y] ) {
														found = true;
														break;
													}
											}
											if ( !found) newArr.push( origArr[x] );
									}
								return newArr;
							}

							matches = unique(matches);

							for (j=0; j<nbargs; j++){
								var find = matches[j];
								var reg = new RegExp(find,"g");
								scriptContent = scriptContent.split(find).join(tabArgs[j]);
							}

							var i = 0;
							serversArray.forEach(function(server, index) {
								var serverName     = server.serverDetails.serverName;
								var serverIp       = server.serverDetails.serverAddress;
								var serverPort     = server.serverDetails.serverPort;
								var serverUsername = server.serverDetails.serverUsername;

								var Connection   = require('ssh2');
								var conn         = new Connection();
								conn.on('ready', function() {

									conn.exec(scriptContent, function(err, stream) {
										if (err) throw err;
										var stdout = '',
												stderr = '';
										stream.on('exit', function(code, signal) {

										}).on('close', function() {

											conn.end();

											tab_stdout[i] = stdout;
											tab_stderr[i] = stderr;
											tab_servname[i] = serverName;

											if (i == serversArray.length -1)
											{
												if(res.headersSent == false){
													//insert into DB
													var newExecution                              = new Execution();
													newExecution.executionDetails.userId          = userId;
													newExecution.executionDetails.scriptId        = scriptId;
													newExecution.executionDetails.scriptName      = scriptName;
													newExecution.executionDetails.serverId        = undefined;
													newExecution.executionDetails.serverName      = undefined;
													newExecution.executionDetails.groupId         = groupId;
													newExecution.executionDetails.groupName       = groupName;
													newExecution.executionDetails.executionStdout = tab_stdout;
													newExecution.executionDetails.executionStderr = tab_stderr;
													newExecution.executionDetails.executionServ   = tab_servname;
													var moment = require('moment');
													newExecution.executionDetails.created_at      = moment().format();
													newExecution.executionDetails.withArgs        = withArgs;
													newExecution.executionDetails.matches         = matches;
													newExecution.executionDetails.tabArgs         = tabArgs;
													newExecution.executionDetails.notes           = notes;
													newExecution.save(function(err, newExecution) {
														if (err){
																	console.log(err);
																	if(res.headersSent == false){res.render('error.ejs');}
														}
																//nothing
															});

													var endDate = new Date();
													var duration = (endDate - beginDate)/1000;

													res.render('exec-results.ejs', {
															stdout: tab_stdout,
															stderr: tab_stderr,
															serverName: tab_servname,
														duration: duration,
														matches : matches,
														tabArgs : tabArgs,
														withArgs : withArgs,
														notes: notes
													});
											  }
											}
											i++;
										}).on('data', function(data) {
											//console.log('STDOUT: \n' + data_dout);
											stdout = stdout + data;
											//console.log('MYSTDOUT: \n' + stdout);
										}).stderr.on('data', function(data) {
										//console.log('STDERR: \n' + data);
											stderr = stderr + data;
										});
									});
								}).connect({
									host: serverIp,
									port: serverPort,
									username: serverUsername,
									privateKey: require('fs').readFileSync('./__ssh_keys/' + userId +'/id_rsa')
								});

								conn.on('error', function(e) {

									tab_stdout[i] = "";
									tab_servname[i] = serverName;
									tab_stderr[i] = "Connection failed or timed : " + e;

									if (i == serversArray.length -1)
									{
										if(res.headersSent == false){
											//insert into DB
											var newExecution                              = new Execution();
											newExecution.executionDetails.userId          = userId;
											newExecution.executionDetails.scriptId        = scriptId;
											newExecution.executionDetails.scriptName      = scriptName;
											newExecution.executionDetails.serverId        = undefined;
											newExecution.executionDetails.serverName      = undefined;
											newExecution.executionDetails.groupId         = groupId;
											newExecution.executionDetails.groupName       = groupName;
											newExecution.executionDetails.executionStdout = tab_stdout;
											newExecution.executionDetails.executionStderr = tab_stderr;
											newExecution.executionDetails.executionServ   = tab_servname;
											var moment = require('moment');
											newExecution.executionDetails.created_at      = moment().format();
											newExecution.executionDetails.withArgs        = withArgs;
											newExecution.executionDetails.matches         = matches;
											newExecution.executionDetails.tabArgs         = tabArgs;
											newExecution.executionDetails.notes           = notes;
											newExecution.save(function(err, newExecution) {
												if (err){
															console.log(err);
															if(res.headersSent == false){res.render('error.ejs');}
												}
														//nothing
													});

											var endDate = new Date();
											var duration = (endDate - beginDate)/1000;

											res.render('exec-results.ejs', {
												stdout: tab_stdout,
												stderr: tab_stderr,
												serverName: tab_servname,
												duration: duration,
												matches : matches,
												tabArgs : tabArgs,
												withArgs : withArgs,
												notes : notes
											});
									  }
									}
									i++;
								});

							}); // end foreach loop
							} // end of else > you are not authorized
						}); //end async

				} //end if on groups
		} // end if arguments
	}); //end global

	// DASHBOARD SECTION, GET MY SERVERS AND GROUPS, AND SCRIPTS
	app.get('/dashboard', isLoggedIn, ensureSecondFactor, function(req, res) {
		var async  = require('async');
	    var Server = require('../app/models/server'); //adding mongoose Schema
	    var Group  = require('../app/models/group'); //adding mongoose Schema
	    var Script = require('../app/models/script');
			var Execution = require('../app/models/execution');
			var Message = require('../app/models/message');
	    async.parallel({
	       servers: function(callback){
	           Server.find({"serverDetails.userId" : req.user._id}).sort({"serverDetails.created_at": 'desc'}).limit(5).exec(callback);
	       },
				nbservs: function(callback){
						Server.count({"serverDetails.userId" : req.user._id}).exec(callback);
				},
	       groups: function(callback){
	           Group.find({"groupDetails.userId" : req.user._id}).exec(callback);
	       },
				executions: function(callback){
						Execution.find({"executionDetails.userId" : req.user._id}).sort({"executionDetails.created_at": 'desc'}).limit(5).exec(callback);
				},
	       nbscripts: function(callback){
	           Script.count({"scriptDetails.userId" : req.user._id}).exec(callback);
	       },
				msg: function(callback){
						Message.findOne({"msgDetails.selector" : 700}).exec(callback);
				}
	    }, function(err, results) {
				if (err){
						console.log(err);
						if(res.headersSent == false){res.render('error.ejs');}
			  }

	       var myServers = results.servers;
	       var myGroups  = results.groups;
	       var nbscripts = results.nbscripts;
				 var myExecutions = results.executions;
				 var moment    = require('moment-timezone');
			 	 var timezone  = req.user.settings.timezone;
				 var nbservs = results.nbservs;
				 var msg = results.msg;

	       res.render('dashboard.ejs', {
	            user : req.user,
	            myServers : myServers,
	            myGroups : myGroups,
	            nbscripts : nbscripts,
							myExecutions : myExecutions,
							moment : moment,
							timezone : timezone,
							nbservs : nbservs,
							msg : msg
	        });
	    });
	});

// SCRIPTS SECTION, GET MY SERVERS AND GROUPS, AND SCRIPTS
	app.get('/scripts', isLoggedIn, ensureSecondFactor, function(req, res) {
		var async  = require('async');
	    var Server = require('../app/models/server'); //adding mongoose Schema
	    var Group  = require('../app/models/group'); //adding mongoose Schema
	    var Script = require('../app/models/script');
	    async.parallel({
	       servers: function(callback){
	           Server.find({$and:[{"serverDetails.userId" : req.user._id}, {"serverDetails.sshStatus" : true}]}).exec(callback); //only servers with sshStatus OK
	       },
	       groups: function(callback){
	           Group.find({"groupDetails.userId" : req.user._id}).exec(callback);
	       },
	       scripts: function(callback){
	           Script.find({"scriptDetails.userId" : req.user._id}).exec(callback);
	       }
	    }, function(err, results) {
				if (err){
						console.log(err);
						if(res.headersSent == false){res.render('error.ejs');}
			  }

	       var myServers = results.servers;
	       var myGroups  = results.groups;
	       var myScripts = results.scripts;
				 var moment    = require('moment-timezone');
				 var timezone  = req.user.settings.timezone;

				res.render('scripts.ejs', {
	            user : req.user,
	            myServers : myServers,
	            myGroups : myGroups,
	            myScripts : myScripts,
							moment : moment,
							timezone : timezone
	        });
	    });
	});

	// SERVERS PAGE, GET MY SERVERS AND GROUPS
	app.get('/servers', isLoggedIn, ensureSecondFactor, function(req, res) {
		var async  = require('async');
	    var Server = require('../app/models/server'); //adding mongoose Schema
	    var Group  = require('../app/models/group'); //adding mongoose Schema
	    async.parallel({
	       servers: function(callback){
	           Server.find({"serverDetails.userId" : req.user._id}).exec(callback);
	       },
	       groups: function(callback){
	           Group.find({"groupDetails.userId" : req.user._id}).exec(callback);
	       }
	    }, function(err, results) {
				if (err){
						console.log(err);
						if(res.headersSent == false){res.render('error.ejs');}
			  }

	       var myServers = results.servers;
	       var myGroups = results.groups;

	       res.render('servers.ejs', {
	            user : req.user,
	            myServers : myServers,
	            myGroups: myGroups
	        });
	    });

	});

	// GROUPS PAGE, GET MY SERVERS AND GROUPS
	app.get('/groups', isLoggedIn, ensureSecondFactor, function(req, res) {
		var async  = require('async');
	    var Server = require('../app/models/server'); //adding mongoose Schema
	    var Group  = require('../app/models/group'); //adding mongoose Schema
	    async.parallel({
	       servers: function(callback){
	           Server.find({"serverDetails.userId" : req.user._id}).exec(callback);
	       },
	       groups: function(callback){
	           Group.find({"groupDetails.userId" : req.user._id}).exec(callback);
	       }
	    }, function(err, results) {
				if (err){
						console.log(err);
						if(res.headersSent == false){res.render('error.ejs');}
			  }

	       var myServers = results.servers;
	       var myGroups = results.groups;
				var moment    = require('moment-timezone');
				var timezone  = req.user.settings.timezone;

	       res.render('groups.ejs', {
	            user : req.user,
	            myServers : myServers,
	            myGroups: myGroups,
							moment : moment,
							timezone : timezone
	        });
	    });
	});

	// EXECUTION HISTORY PAGE, GET MY EXECUTIONS
	app.get('/exec-history', isLoggedIn, ensureSecondFactor, function(req, res) {
		  var async  = require('async');
			var Execution = require ('../app/models/execution');
			var User = require ('../app/models/user');
			async.parallel({
				executions: function(callback){
						Execution.find({"executionDetails.userId" : req.user._id}).exec(callback);
				}
			}, function(err, results) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}

				var myExecutions = results.executions;
				var moment = require('moment-timezone');
				var timezone = req.user.settings.timezone;

				res.render('exec-history.ejs',{
							user : req.user,
							myExecutions : myExecutions,
							moment : moment,
							timezone : timezone
					});
			});
	});

	// GET EXECUTION DETAILS
	app.get('/exec-details', isLoggedIn, ensureSecondFactor, function(req, res) {

		  var url             = require('url');
		  var url_parts       = url.parse(req.url, true);
		  var query           = url_parts.query;
			var execId          = query.execId;

			var async     = require('async');
			var Execution = require ('../app/models/execution');
			async.parallel({
				executions: function(callback){
						Execution.find({$and:[{"_id" : execId}, {"executionDetails.userId" : req.user._id}]}).exec(callback);
				}
			}, function(err, results) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}

				var execution = results.executions;
				var moment    = require('moment-timezone');
				var timezone  = req.user.settings.timezone;

				var serverNameArray = execution[0].executionDetails.executionServ;
				var stdoutArray     = execution[0].executionDetails.executionStdout;
				var stderrArray     = execution[0].executionDetails.executionStderr;

				res.render('exec-details.ejs',{
							user : req.user,
							execution : execution,
							serverNameArray : serverNameArray,
							stdoutArray : stdoutArray,
							stderrArray : stderrArray,
							moment : moment,
							timezone : timezone
					});
			});
	});

	// LOGOUT ==============================
	app.get('/logout', function(req, res) {
		req.session.secondFactor = '';
		req.logout();
		res.redirect('/');
	});

	// ADDING NEW SERVER ===================
	 app.post('/newserv', isLoggedIn, ensureSecondFactor, function(req, res) {

		  var async     = require('async');
			var Server    = require('../app/models/server');

			async.parallel({
				nbservs: function(callback){
						Server.count({"serverDetails.userId" : req.user._id}).exec(callback);
				}
			}, function(err, results) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}

			var mynbservs = results.nbservs;

			var newServer                          = new Server();
			newServer.serverDetails.userId         = req.user._id;
			newServer.serverDetails.serverName     = req.body.serverName;
			newServer.serverDetails.serverAddress  = req.body.serverIp;
			newServer.serverDetails.serverPort     = req.body.serverPort;
			newServer.serverDetails.serverUsername = req.body.serverUser;
			newServer.serverDetails.serverTags     = req.body.serverTag;
			newServer.serverDetails.serverGroups   = req.body.serverGroup;
			newServer.serverDetails.sshStatus      = 0; // false, not connected right now
			var moment = require('moment');
			newServer.serverDetails.created_at     = moment().format();

		    newServer.save(function(err, newServer) {
					if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				  }
	            res.redirect('/servers');
	        });
		 });
	});

	 // EDITING SERVER ===================
	 app.post('/editserv', isLoggedIn, ensureSecondFactor, function(req, res) {

		var Server                             = require('../app/models/server');

		Server.findById(req.body.serverId, function (err, server){
			if (server.serverDetails.userId == req.user._id){
				var changed = false;
				if (server.serverDetails.serverAddress != req.body.serverIp || server.serverDetails.serverPort != req.body.serverPort || server.serverDetails.serverUsername != req.body.serverUser){
					changed = true;
				}

				server.serverDetails.serverName     = req.body.serverName;
				server.serverDetails.serverAddress  = req.body.serverIp;
				server.serverDetails.serverPort     = req.body.serverPort;
				server.serverDetails.serverUsername = req.body.serverUser;
				server.serverDetails.serverTags     = req.body.serverTag;
				server.serverDetails.serverGroups   = req.body.serverGroup;

				if (changed == true){
					server.serverDetails.sshStatus      = false;
				}

			    server.save(function(err, server) {
						if (err){
								console.log(err);
								if(res.headersSent == false){res.render('error.ejs');}
					  }
		            res.redirect('/servers');
		        });
			}else{
					res.render('bad-request.ejs', {
						user : req.user
					});
			}
	 	});
	 });

	 // DELETING SERVER ===================
	 app.post('/deleteserv', isLoggedIn, ensureSecondFactor, function(req, res) {

		var Server                             = require('../app/models/server');

		Server.findById(req.body.serverId, function (err, server){

			if (server.serverDetails.userId == req.user._id){
				Server.remove({ _id: req.body.serverId }, function (err) {
					if (err){
								console.log(err);
								if(res.headersSent == false){res.render('error.ejs');}
					}
				  // removed!
				});
				res.redirect('/servers');
			}else{
				res.render('bad-request.ejs', {
					user : req.user
				});
			}
		});
	 });

	 // ADDING NEW GROUP ===================
	 app.post('/newgroup', isLoggedIn, ensureSecondFactor, function(req, res) {

		var Group                        = require('../app/models/group');
		var newGroup                     = new Group();
		newGroup.groupDetails.userId     = req.user._id;
		newGroup.groupDetails.groupName  = req.body.groupName;
		newGroup.groupDetails.groupDesc  = req.body.groupDesc;
		var moment = require('moment');
		newGroup.groupDetails.created_at = moment().format();

	    newGroup.save(function(err, newGroup) {
				if (err){
						console.log(err);
						if(res.headersSent == false){res.render('error.ejs');}
		  	}
            res.redirect('/groups');
        });
	 });

	 // EDITING GROUP ===================
	 app.post('/editgroup', isLoggedIn, ensureSecondFactor, function(req, res) {

		var Group                             = require('../app/models/group');

		Group.findById(req.body.groupId, function (err, group){
			if (group.groupDetails.userId == req.user._id){
			group.groupDetails.groupName        = req.body.groupName;
			group.groupDetails.groupDesc        = req.body.groupDesc;

		    group.save(function(err, group) {
					if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				  }
	            res.redirect('/groups');
	        });
			}else{
				res.render('bad-request.ejs', {
					user : req.user
				});
			}
	 	});
	 });

	 // DELETING GROUP ===================
	 app.post('/deletegroup', isLoggedIn, ensureSecondFactor, function(req, res) {

		var Group                             = require('../app/models/group');

		Group.findById(req.body.groupId, function (err, group){

			if (group.groupDetails.userId == req.user._id){

			Group.remove({ _id: req.body.groupId }, function (err) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}
			  // removed!
			});
			res.redirect('/groups');
			}else{
				res.render('bad-request.ejs', {
					user : req.user
				});
			}
	  });
	});

	// DELETING EXECUTION ===================
	app.post('/deleteexec', isLoggedIn, ensureSecondFactor, function(req, res) {

	var Execution                             = require('../app/models/execution');

		Execution.findById(req.body.execId, function (err, execution){

			if (execution.executionDetails.userId == req.user._id){

			Execution.remove({ _id: req.body.execId }, function (err) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}
				// removed!
			});
			res.redirect('/exec-history');
			}else{
				res.render('bad-request.ejs', {
					user : req.user
				});
			}
		});
	});

	// DELETING SELECTED EXECUTION ===================
	app.post('/deleteselectedexec', isLoggedIn, ensureSecondFactor, function(req, res) {

	var Execution                             = require('../app/models/execution');

	var execIdTab = req.body.execId;

	if (Array.isArray(execIdTab)){
		execIdTab.forEach(function(execId, index) {
			Execution.remove({ _id: execId }, function (err) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}
				// removed!
			});
		});
	}else{
			Execution.remove({ _id: execIdTab }, function (err) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}
				// removed!
			});
	}
	res.redirect('/exec-history');
	});

	 // ADDING NEW SCRIPT ===================
	 app.post('/newscript', isLoggedIn, ensureSecondFactor, function(req, res) {

			var async     = require('async');
			var Script    = require('../app/models/script');

			async.parallel({
				nbscripts: function(callback){
						Script.count({"scriptDetails.userId" : req.user._id}).exec(callback);
				}
			}, function(err, results) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}

			var mynbscripts = results.nbscripts;

			var newScript                         = new Script();
			newScript.scriptDetails.withArgs      = false;
			newScript.scriptDetails.userId        = req.user._id;
			newScript.scriptDetails.scriptName    = req.body.scriptName;
			newScript.scriptDetails.scriptNotes   = req.body.scriptNotes;
			var scriptContent 							      = req.body.scriptContent.replace(/(\r)/gm,""); // remove \r from the string
			newScript.scriptDetails.scriptContent = scriptContent;
			var moment = require('moment');
			newScript.scriptDetails.created_at    = moment().format();

			//Check if the script contains arguments based on the regex
			if (/(\{\{arg\:\$[a-zA-Z0-9_-]+\}\})/.test(scriptContent)){
				newScript.scriptDetails.withArgs      = true;
			}

		    newScript.save(function(err, newScript) {
					if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				  }
	            res.redirect('/scripts');
	        });
		 });
	});

	// EDITING SCRIPT ===================
	app.post('/editscript', isLoggedIn, ensureSecondFactor, function(req, res) {

		var Script                             = require('../app/models/script');

		Script.findById(req.body.scriptId, function (err, script){
			if(script.scriptDetails.userId == req.user._id){
			script.scriptDetails.withArgs        = false;
			script.scriptDetails.scriptName      = req.body.scriptName;
			script.scriptDetails.scriptNotes     = req.body.scriptNotes;
			var scriptContent 							     = req.body.scriptContentEdit.replace(/(\r)/gm,""); // remove \r from the string
			script.scriptDetails.scriptContent   = scriptContent;

			//Check if the script contains arguments based on the regex
			if (/(\{\{arg\:\$[a-zA-Z0-9_-]+\}\})/.test(scriptContent)){
				script.scriptDetails.withArgs        = true;
			}

			script.save(function(err, script) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}
				res.redirect('/scripts');
			});
			}else{
				res.render('bad-request.ejs', {
					user : req.user
				});
			}
		});
	});

	// DELETING SCRIPT ===================
	app.post('/deletescript', isLoggedIn, ensureSecondFactor, function(req, res) {

		var Script                             = require('../app/models/script');

		Script.findById(req.body.scriptId, function (err, script){

			if (script.scriptDetails.userId == req.user._id){

			Script.remove({ _id: req.body.scriptId }, function (err) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}
				// removed!
			});
			res.redirect('/scripts');
			}else{
				res.render('bad-request.ejs', {
					user : req.user
				});
			}
		});
	});

	// DELETING SELECTED SCRIPTS ===================
	app.post('/deleteselectedscript', isLoggedIn, ensureSecondFactor, function(req, res) {

		var Script                             = require('../app/models/script');

		var scriptIdTab = req.body.scriptId;

		if (Array.isArray(scriptIdTab)){
			scriptIdTab.forEach(function(scriptId, index) {
				Script.remove({ _id: scriptId }, function (err) {
					if (err){
								console.log(err);
								if(res.headersSent == false){res.render('error.ejs');}
					}
					// removed!
				});
			});
		}else{
			Script.remove({ _id: scriptIdTab }, function (err) {
				if (err){
							console.log(err);
							if(res.headersSent == false){res.render('error.ejs');}
				}
				// removed!
			});
		}
		res.redirect('/scripts');
	});

	 // GENERATING SSH KEYS =================== // SSH-KEYGEN IS USED ON THE HOST
	 app.post('/newkey', isLoggedIn, ensureSecondFactor, function(req, res) {

		var fse = require('fs-extra');
		var fs = require('fs');

		var userId = req.user._id;
		var dir = './__ssh_keys/' + userId;
		var publicKey = './__ssh_keys/' + userId + '/id_rsa.pub';
		var privateKey = './__ssh_keys/' + userId + '/id_rsa';

		fse.ensureDir(dir, function(err) {
		  //console.log(err) // => null
		  //dir has now been created, including the directory
		})

		var keygen = require('ssh-keygen2')
		  , assert = require('assert')

		var opts = {
  			type: 'rsa',
  			bits: 4096,
  			comment: 'lineshell'
  		};

		// generate a temporary keypair and return details
		keygen(opts, function (err, keypair) {
		  assert.ifError(err);
		  fse.outputFile(publicKey, keypair.public, function(err) {
			})

		    fse.outputFile(privateKey, keypair.private, function(err) {
			})

			var User     = require('../app/models/user');
			var moment   = require('moment');

			User.findById(userId, function (err, user){
				user.keys.pub        = keypair.public;
				user.keys.created_at = moment().format();


			    user.save(function(err, user) {
						if (err){
								console.log(err);
								if(res.headersSent == false){res.render('error.ejs');}
					  }
		            res.redirect('/settings');
		        });
		 	});

		});
	 });

  // SAVE TIMEZONE SETTINGS
	app.post('/savetimezone', isLoggedIn, ensureSecondFactor, function(req, res) {

		var userId   = req.user._id;
		var timezone = req.body.timezone;

		var User     = require('../app/models/user');

		User.findById(userId, function (err, user){
			user.settings.timezone   = timezone;

				user.save(function(err, user) {
					if (err){
								console.log(err);
								if(res.headersSent == false){res.render('error.ejs');}
					}
							res.redirect('/settings');
					});
		});

	});

	// EDIT PROFILE INFORMATION
	app.post('/editprofile', isLoggedIn, ensureSecondFactor, function(req, res) {

		var bcrypt   = require('bcrypt-nodejs');

		if (req.session.error != undefined){
			delete req.session.error;
		};
		var currpwd  = req.body.currpwd;
		var userId   = req.user._id;
		var email    = req.body.email.toLowerCase();
		var newPass  = req.body.newPass;

		if(bcrypt.compareSync(currpwd, req.user.local.password) == true){

			var User     = require('../app/models/user');

			User.findById(userId, function (err, user){

					User.findOne({$and:[{"local.email" : email}, {"_id" : {'$ne': userId }}]}, function(err, alreadyused) {

						if (err){
									console.log(err);
									if(res.headersSent == false){res.render('error.ejs');}
						}

					if (alreadyused) {
						req.session.error = 'Email address already used! Nothing was changed on your profile!';
						res.redirect('/profile');
					}
					else {

						if (user.local.email != email){
							user.local.email = email;
						};

						if (newPass != ""){
							user.local.password = user.generateHash(newPass);
						}

						user.save(function(err, user) {
							if (err){
										console.log(err);
										if(res.headersSent == false){res.render('error.ejs');}
							}
										req.session.error = 'Profile has been updated !';
										res.redirect('/profile');
						});

					};

				});

			});
	 }else{
		req.session.error = 'Incorrect current password! Nothing was changed on your profile!';
		res.redirect('/profile');
	}

	});

// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

	// locally --------------------------------
		// LOGIN ===============================
		// show the login form
		app.get('/login', function(req, res) {
			res.render('login.ejs', { message: req.flash('loginMessage') });
		});

		// // process the login form
		// app.post('/login', passport.authenticate('local-login', {
		// 	successRedirect : '/dashboard', // redirect to the secure profile section
		// 	failureRedirect : '/login', // redirect back to the signup page if there is an error
		// 	failureFlash : true // allow flash messages
		// }));

		// process the login form
		app.post('/login', passport.authenticate('local-login', { failureRedirect: '/login', failureFlash : true }),
		  function(req, res) {
				if (req.user.gauth.activated){
					//console.log("GAUTH activated");

					res.redirect('/login-otp');
				}else{
					//console.log("GAUTH not activated");
					res.redirect('/dashboard');
				}
		});


		// SIGNUP =================================
		// show the signup form
		app.get('/signup', function(req, res) {

				res.render('signup.ejs', { message: req.flash('signupMessage')});

		});

		// process the signup form
		app.post('/signup', passport.authenticate('local-signup', {
			successRedirect : '/dashboard', // redirect to the secure profile section
			failureRedirect : '/signup', // redirect back to the signup page if there is an error
			failureFlash : true // allow flash messages
		}));

	// facebook -------------------------------

		// send to facebook to do the authentication
		app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));

		// handle the callback after facebook has authenticated the user
		app.get('/auth/facebook/callback',
			passport.authenticate('facebook', {
				successRedirect : '/dashboard',
				failureRedirect : '/'
			}));

	// twitter --------------------------------

		// send to twitter to do the authentication
		app.get('/auth/twitter', passport.authenticate('twitter', { scope : 'email' }));

		// handle the callback after twitter has authenticated the user
		app.get('/auth/twitter/callback',
			passport.authenticate('twitter', {
				successRedirect : '/dashboard',
				failureRedirect : '/'
			}));


	// google ---------------------------------

		// send to google to do the authentication
		app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

		// the callback after google has authenticated the user
		app.get('/auth/google/callback',
			passport.authenticate('google', {
				successRedirect : '/dashboard',
				failureRedirect : '/'
			}));

// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

	// locally --------------------------------
		app.get('/connect/local', function(req, res) {
			res.render('connect-local.ejs', { message: req.flash('loginMessage') });
		});
		app.post('/connect/local', passport.authenticate('local-signup', {
			successRedirect : '/profile', // redirect to the secure profile section
			failureRedirect : '/connect/local', // redirect back to the signup page if there is an error
			failureFlash : true // allow flash messages
		}));
		app.post('/connect/local-add', isLoggedIn, passport.authenticate('local-signup-add', {
			successRedirect : '/profile', // redirect to the secure profile section
			failureRedirect : '/connect/local-add', // redirect back to the signup page if there is an error
			failureFlash : true // allow flash messages
		}));

	// facebook -------------------------------

		// send to facebook to do the authentication
		app.get('/connect/facebook', passport.authorize('facebook', { scope : 'email' }));

		// handle the callback after facebook has authorized the user
		app.get('/connect/facebook/callback',
			passport.authorize('facebook', {
				successRedirect : '/profile',
				failureRedirect : '/'
			}));

	// twitter --------------------------------

		// send to twitter to do the authentication
		app.get('/connect/twitter', passport.authorize('twitter', { scope : 'email' }));

		// handle the callback after twitter has authorized the user
		app.get('/connect/twitter/callback',
			passport.authorize('twitter', {
				successRedirect : '/profile',
				failureRedirect : '/'
			}));


	// google ---------------------------------

		// send to google to do the authentication
		app.get('/connect/google', passport.authorize('google', { scope : ['profile', 'email'] }));

		// the callback after google has authorized the user
		app.get('/connect/google/callback',
			passport.authorize('google', {
				successRedirect : '/profile',
				failureRedirect : '/'
			}));

// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts. for social accounts, just remove the token
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

	/*// local -----------------------------------
	app.get('/unlink/local', isLoggedIn, function(req, res) {
		var user            = req.user;
		user.local.email    = undefined;
		user.local.password = undefined;
		user.save(function(err) {
			res.redirect('/profile');
		});
	});*/

	// facebook -------------------------------
	app.get('/unlink/facebook', isLoggedIn, ensureSecondFactor, function(req, res) {
		var user            = req.user;
		user.facebook.token = undefined;
		user.save(function(err) {
			res.redirect('/profile');
		});
	});

	// twitter --------------------------------
	app.get('/unlink/twitter', isLoggedIn, ensureSecondFactor, function(req, res) {
		var user           = req.user;
		user.twitter.token = undefined;
		user.save(function(err) {
			res.redirect('/profile');
		});
	});

	// google ---------------------------------
	app.get('/unlink/google', isLoggedIn, ensureSecondFactor, function(req, res) {
		var user          = req.user;
		user.google.token = undefined;
		user.save(function(err) {
			res.redirect('/profile');
		});
	});


};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
	if (req.isAuthenticated())
		return next();

	res.redirect('/');
}
