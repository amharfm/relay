var http = require("http"),
	fs = require("fs"),
	ws = require("nodejs-websocket"),
	addr = require("address"),
	sqlite3 = require("sqlite3").verbose();

const ver = 1.0;

var db, server;
var filename = 'vote.db',
	port = 8081;

console.log('-------------------------------')
console.log('Welcome to MHSU e-voting election server')
console.log('made by ICT SEP MHIS 2016')
console.log('-------------------------------')

server = ws.createServer(function (conn){
	fs.exists(filename, function(ex){
		if (ex) fs.stat(filename, function(err, stats){
			fs.open(filename, "r", function(err, fd){
				var buffer = new Buffer(stats.size);
				fs.read(fd, buffer, 0, buffer.length, null, function(err, bytesRead, buffer){
					var data = buffer.toString("utf8", 0, buffer.length);
					db = new sqlite3.Database(filename);

					fs.close(fd);
	}); }); }); });

	var count;
	var votes = [];
	var num_ = -1;
	var dots = '.';
	conn.on("text", function(str){
		var msg = JSON.parse(str);
		ip = conn.socket.remoteAddress

		switch (msg.to){
			case 'login':
				conn.send(JSON.stringify({
					'to': 'logged in',
					'c': ip
				}))
				console.log(ip + ' comes in')
				break;
			case 'get groups':
				var result = [];
				var wait = setInterval(function(){
					if (db){
						db.serialize(function(e){
							if (e) throw e;
							db.each("SELECT name FROM groups ORDER BY id ASC", function (err,row){
						 		if (err) throw err;
						 		if (row) result.push(row);
						 	}, function(){
						 		conn.sendText(JSON.stringify({
						 			"to": "list groups",
									"c": result
								}));
						 	})
						clearInterval(wait);
						});
					} else {
						console.log('wait for db..')
					}
				},1000);
				break;
			case 'get voters':
				var result = [];
				db.serialize(function(e){
					if (e) throw e;
					db.each("SELECT v.name, v.voted FROM voter v, groups g WHERE v.id_group=g.id AND g.name=$g AND v.voted=$v ORDER BY v.name ASC;", {
						$g : msg.c,
						$v : 'FALSE'
					}, function (err,row){
				 		if (err) throw err;
				 		if (row) result.push(row);
				 	}, function(){
				 		conn.sendText(JSON.stringify({
				 			"to": "list voters",
							"c": result
						}));
				 	})
				});
				break;
			case 'get nominations':
				var result = [];
				db.serialize(function(e){
					if (e) throw e;
					db.each("SELECT n.id, c.name AS category, n.artist, n.preview, n.title FROM nominations n, category c WHERE n.id_cat=c.id ORDER BY category ASC", function (err,row){
				 		if (err) throw err;
				 		if (row) result.push(row);
				 	}, function(){
				 		conn.sendText(JSON.stringify({
				 			"to": "list nominations",
							"c": result
						}));
				 	})
				});
				break;
			case 'vote':
				var category = ['Candidates'];
				var count = 0;
				category.forEach(function(c){
					var qry  = "INSERT INTO vote(id_voter,id_nom,timestamp,ip) VALUES(";
						qry += "(SELECT id FROM voter WHERE name='"+msg.v+"'), ";
						qry += msg['noms'][c]+", ";
						qry += "'"+ (new Date().toLocaleString()) + "', ";
						qry += "'"+ip + "'); ";
					db.run(qry, function(){
						count++;
					});
				});
				
				var wait = setInterval(function(){
					if (count==category.length){
						clearInterval(wait);
						db.serialize(function(e){
							if (e) throw e;
							var qry = "UPDATE voter SET voted='TRUE' ";
							  	qry += "WHERE name='"+msg['v']+"';";
							db.run(qry, function(){
								conn.sendText(JSON.stringify({
						 			"to": "voted"
								}));
								console.log(msg['v'], 'has voted')
							});
						});
					} else console.log('wait..')
				},1000)
				break;
			case 'awards' :
				var final = [];
				db.serialize(function(e){
					if (e) throw e;
					db.each("select v.id_nom, n.artist, n.title, c.name, count(v.id_nom) as sum from vote v, nominations n, category c where v.id_nom=n.id and c.id=n.id_cat group by v.id_nom order by c.id,sum DESC", function (err,row){
				 		if (err) throw err;
				 		if (row) final.push(row);
				 	}, function(){
				 		conn.sendText(JSON.stringify({
				 			"to": "awards",
							"c": final
						}));
				 	})
				});
				break;
			case 'voterz':
				var votevote = [];
				db.serialize(function(e){
					if (e) throw e;
					db.each("select voter.name from vote, voter where vote.id_voter=voter.id group by id_voter order by voter.name ASC;", function (err,row){
				 		if (err) throw err;
				 		if (row) votevote.push(row.name);
				 	}, function(){
				 		conn.sendText(JSON.stringify({
				 			"to": "voterz",
							"c": votevote
						}));
				 	})
				});
				break;
			case 'livecounting':
				if (votes.length==0){
					db.serialize(function(e){
						if (e) throw e;
						db.each("select id, id_nom from vote;", function (err,row){
					 		if (err) throw err;
					 		if (row) {votes.push(row);}
					 	}, function(){
					 		console.log('Counting is ready');
					 		conn.sendText(JSON.stringify({
					 			"to": "countingIsReady"
							}));
					 		num_++;
					 	})
				});
				} else {
					if (num_<=votes.length){
						// console.log(votes[num_]);
						console.log(dots);
						if (dots.length<3) dots += '.';
						 else dots = '.';
						conn.sendText(JSON.stringify({
				 			"to": "countingIsReady",
				 			"num": num_,
				 			"c": votes[num_],
				 			"tot": votes.length
						}));
						num_++;
					} else {
						console.log("the next Leader&ViceLeader is...")
						conn.sendText(JSON.stringify({
				 			"to": "countingIsReady",
				 			"num": num_,
				 			"c": 'finish',
				 			"tot": votes.length
						}));
					}

				}
				break;
			default : console.log('whaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.');
				break;
		}
	});
	conn.on("close", function(str){});
	conn.on("error", function(str){});
}).listen(port)