// The MIT License (MIT)

// Copyright (c) 2015 SkyNxt.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var SkyNxt = (function(SkyNxt, $, undefined) {
//var peers = ['108.61.7.242', 'wallet-03.xel-project.org', 'wallet-04.xel-project.org', 'wallet-05.xel-project.org'];
var peers = ['108.61.7.242', 'wallet-03.xel-project.org', 'wallet-04.xel-project.org', 'wallet-05.xel-project.org' ];



var peerTraverse = 0;
var HTTP = "http://";
var HTTPS = "https://";
SkyNxt.PORT = "17876";
var ITR2_PEER_TRAVERSE = 150; //for mobile devices do not try to reach more than this number of peers in second iteration of peer discovery
var SLEEP_TIME = 5000; //5000 = 5 seconds
var peersfrmDB = [];
var apipeersfrmDB = [];
SkyNxt.database = new loki('SkyNxt.json');
var peersdbs;
var apipeersdb;
var api_disabled_peersdb;
var peerbalancedb;
SkyNxt.trustedpeersdb;
SkyNxt.ADDRESS = "";
SkyNxt.PEER_IP = [];

SkyNxt.discover = function()
{
	loaderIconText('Peer discovery started..');
	SkyNxt.database.removeCollection('peers');
	peersdbs = SkyNxt.database.addCollection('peers');

	SkyNxt.database.removeCollection('apipeers');
	apipeersdb = SkyNxt.database.addCollection('apipeers');

	SkyNxt.database.removeCollection('apidisabledpeers');
	api_disabled_peersdb = SkyNxt.database.addCollection('apidisabledpeers');

	SkyNxt.database.removeCollection('peerbalance');
	peerbalancedb = SkyNxt.database.addCollection('peerbalance');

	SkyNxt.database.removeCollection('trustedpeers');
	SkyNxt.trustedpeersdb = SkyNxt.database.addCollection('trustedpeers');

	for(var i = 0; i < peers.length; i++)
	{
		discoverPeers(HTTP + peers[i]);
	}

	setTimeout(executeItr_1, SLEEP_TIME);
}

function executeItr_1()
{
	if(peerTraverse < peers.length-1)
	{
		loaderIconText('Searching peers: ' + peerTraverse + "/" + peers.length);
		setTimeout(executeItr_1, SLEEP_TIME)
		return;
	}
	peerTraverse = 0;
	for(i = 1; i <= peersdbs.data.length; i++)
	{
		data = peersdbs.get(i);
		var ip = HTTP + data.nwpeer;
		peersfrmDB.push(ip);
		discoverPeers(ip);

		if(i >= ITR2_PEER_TRAVERSE)
		{
			break;
		}
	}
	setTimeout(executeItr_2, SLEEP_TIME);
}

function executeItr_2()
{
	var total = peersfrmDB.length;
   if((peerTraverse + ((total*5)/100)) < (total - 1))
   {
		loaderIconText('Searching peers: ' + peerTraverse + "/" + peersfrmDB.length);
		setTimeout(executeItr_2, SLEEP_TIME)
		return;
   }
   peerTraverse = 0;
	for(i = 1; i <= apipeersdb.data.length; i++)
	{
		data = apipeersdb.get(i);
		var ip = data.peer;
		apipeersfrmDB.push(ip);
		trustedPeers(ip);
	}

	setTimeout(executeItr_3, SLEEP_TIME);
}

function executeItr_3()
{
	var total = apipeersfrmDB.length;
   if((peerTraverse + ((total*5)/100)) < (total - 1))
   {
		loaderIconText('Searching peers: ' + peerTraverse + "/" + apipeersfrmDB.length);
		setTimeout(executeItr_3, SLEEP_TIME)
		return;
   }
   populateTrustedPeers();
}

function discoverPeers(ip)
{
	var url = "";
	if(api_disabled_peersdb.findOne({'apidispeer': ip}) != null || apipeersdb.findOne({'peer': ip}) != null)
	{
		peerTraverse++;
		return;
	}

	 if(ip.indexOf(":") != -1)
		url = ip + ':' + SkyNxt.PORT +'/nxt?requestType=getPeers';
	else
		url = ip + '/nxt?requestType=getPeers';

	var apiPeers = [];
	$.ajax({
			url: url,
			crossDomain: true,
			type: "POST",
			async: true
		}).done(function(json) {
			if (json.errorCode && !json.errorDescription) {
				json.errorDescription = (json.errorMessage ? json.errorMessage : $.t("server_error_unknown"));
			}
			var parsedjson = $.parseJSON(json);
			var error = false;
			$(parsedjson).each(function(i,val){
				$.each(val,function(k,v){
				  if(k == "peers")
				  {
					  $(v).each(function(j,peer){
						var httppeer = HTTP + peer;
						if(peersdbs.findOne({'nwpeer': peer}) == null && apipeersdb.findOne({'peer': httppeer}) == null && api_disabled_peersdb.findOne({'apidispeer': httppeer}) == null)
						{
							peersdbs.insert({nwpeer: peer });
						}
					});
				  }
				  if(k == "errorDescription")
				  {
					  error = true;
				  }
			});
			});
			if(apipeersdb.findOne({'peer': ip}) == null && !error)
			{
				apipeersdb.insert({peer: ip});
			}
			peerTraverse++;
		}).fail(function(xhr, textStatus, error) {
			if(api_disabled_peersdb.findOne({'apidispeer': ip}) == null)
			{
				api_disabled_peersdb.insert({apidispeer: ip});
			}
			peerTraverse++;
		});
}

function trustedPeers(ip)
{
	var url = '/nxt?requestType=getBalance&account=XEL-MAYC-ZZ3Y-YX56-6NH52';
	 if(ip.indexOf(":") != -1)
		url = ip + ':' + SkyNxt.PORT + url; //trustedPeers should be called only after paraphrase is entered
	else
		url = ip + url; //trustedPeers should be called only after paraphrase is entered
	var trustedPeers = [];
	$.ajax({
			url: url,
			crossDomain: true,
			type: "POST",
			async: true
		}).done(function(json) {
			if (json.errorCode && !json.errorDescription) {
				json.errorDescription = (json.errorMessage ? json.errorMessage : $.t("server_error_unknown"));
			}
			var parsedjson = $.parseJSON(json);
			$(parsedjson).each(function(i,balance){
			var balanceVal = 0;
			if(balance.guaranteedBalanceNQT == 'undefined' || balance.guaranteedBalanceNQT == undefined)
				balanceVal = 0;
			else
				balanceVal = balance.guaranteedBalanceNQT;

			peerbalancedb.insert({peer: ip, guaranteedBalanceNQT : balanceVal});
			peerTraverse++;
			});
			}).fail(function(xhr, textStatus, error) {
			peerTraverse++;
		});
}

function populateTrustedPeers()
{
	var balanceList = peerbalancedb.chain().simplesort("guaranteedBalanceNQT").data();
	counter = {}

	balanceList.forEach(function(obj) {
		var key = JSON.stringify(obj.guaranteedBalanceNQT)
		counter[key] = (counter[key] || 0) + 1
	})

	var guranteedBalance = 0;
	var guranteedBalanceCount = 0;
	var init = true;
	for (var m in counter){
		if(init)
		{
			guranteedBalance = m;
			guranteedBalanceCount = counter[m];
			init = false;
		}
		if(counter[m] > guranteedBalanceCount)
		{
			guranteedBalance = m;
			guranteedBalanceCount = counter[m];
		}
	}

	var trustedPeerList = "";
	SkyNxt.PEER_IP = [];
	for(var i = 0; i < balanceList.length; i++)
	{
		if(JSON.stringify(balanceList[i].guaranteedBalanceNQT) == guranteedBalance)
		{
			var peerIP = balanceList[i].peer;
			SkyNxt.trustedpeersdb.insert({ip_peer : peerIP});
			trustedPeerList = peerIP + "," + trustedPeerList;
			SkyNxt.PEER_IP.push(peerIP);
		}
	}

	var userdbs = SkyNxt.usersettings.getCollection(SkyNxt.USER_SETTING_COLLECTION);

	if(userdbs == null || userdbs == 'undefined')
	{
		userdbs = SkyNxt.usersettings.addCollection(SkyNxt.USER_SETTING_COLLECTION);
		userdbs.insert({key:SkyNxt.TRUSTED_PEERS, value:trustedPeerList});
	}
	else
	{
		var trustedPeerdata = userdbs.findOne({'key' : SkyNxt.TRUSTED_PEERS});
		trustedPeerdata.value = trustedPeerList
		userdbs.update(trustedPeerdata);
	}

	try{
		SkyNxt.createWrite(SkyNxt.FILE_ENTRY);
   } catch (e) {
	}
	SkyNxt.getPeer();
	console.log(SkyNxt.ADDRESS)
	loaderIcon('hide');
}
	return SkyNxt;
 }(SkyNxt || {}, jQuery));
