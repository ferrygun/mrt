'use strict'
/*
[ [ 'Next MRT',			data[0][0]
    '2 min(s)',			data[0][1]
    'Pasir Ris',		data[0][2]
    'Next MRT',			data[0][3]
    '4 min(s)',			data[0][4]
    'Joo Koon' ],		data[0][5]

  [ 'Subsequent MRT',	data[1][0]
    '6 min(s)',			data[1][1]
    'Pasir Ris',		data[1][2]
    'Subsequent MRT',	data[1][3]
    '8 min(s)',			data[1][4]
    'Joo Koon' ] ]		data[1][5]


EWL in the direction of Pasir Ris
 Next MRT	Subsequent MRT
2 min(s)  [01]	6 min(s)   [11]
Pasir Ris [02]	Pasir Ris  [12]

EWL in the direction of Joo Koon
Next MRT	Subsequent MRT
4 min(s)  [04]	8 min(s)   [14]
Joo Koon  [05]	Joo Koon   [15]
*/

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const RateLimit = require('express-rate-limit');

const cheerio = require('cheerio');
const cheerioAdv = require('cheerio-advanced-selectors')
const cheerioTableparser = require('cheerio-tableparser');

const Spreadsheet = require('edit-google-spreadsheet');

const mainurl = "http://trainarrivalweb.smrt.com.sg/";
const posturl = "http://trainarrivalweb.smrt.com.sg/default.aspx";

let stationcode;
let direction = [];
let nextTrain = [];
let nextTrainFinalDtn = [];
let subTrain = [];
let subTrainFinalDtn = [];


function getKey(key, cb){
	Spreadsheet.load({
		debug: false,
		spreadsheetId: '',
		worksheetName: 'key',
		oauth : {
			email: '',
			keyFile: 'fd.pem'
		}
	},

	function sheetReady(err, spreadsheet) {
		if (err) 
			throw err;
		
		let apikey = false;
		spreadsheet.receive(function(err, rows, info) {
			if (err) 
				throw err;

			let j=0; 
			for (let i=2; i<= info.totalRows; i++) {
				if(rows[i][1] == key) 
					apikey = true;
				j++;
			}
			cb(apikey);
		});
	})
}

function init(callback) {
    request({
        uri: mainurl,
        method: "GET",
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36',
        },
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10
    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            callback(true);
        } else {
            callback(false);
        }
    });
}

function requestArrivalTiming(stationcode, callback) {
    request({
		uri: posturl,
        method: "POST",
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36',
        },
        form: {
            ScriptManager1: "UP1|ddlStation",
            __LASTFOCUS: "",
            __EVENTTARGET: "",
            __EVENTARGUMENT: "",
            __VIEWSTATE: "/wEPDwUKMTgzMTU4ODI4Mg9kFgICAw9kFgICAw9kFgJmD2QWBAIBD2QWBAIBDw9kFgQeC29ubW91c2VvdmVyBSRyZXR1cm4gY2hhbmdlQnRuSW1hZ2UodGhpcywgJ292ZXInKTseCm9ubW91c2VvdXQFI3JldHVybiBjaGFuZ2VCdG5JbWFnZSh0aGlzLCAnb3V0Jyk7ZAIDDxYCHgdWaXNpYmxlZ2QCAw9kFgQCAQ8QZBAVUAZTZWxlY3QQQWRtaXJhbHR5IChOUzEwKQ5BbGp1bmllZCAoRVc5KRFBbmcgTW8gS2lvIChOUzE2KQ5CYXJ0bGV5IChDQzEyKQ9CYXkgRnJvbnQgKENFMikLQmVkb2sgKEVXNSkSQmlzaGFuIChDQzE1L05TMTcpD0Jvb24gTGF5IChFVzI3KRZCb3RhbmljIEdhcmRlbnMgKENDMTkpD0JyYWRkZWxsIChOUzE4KRBCcmFzIEJhc2FoIChDQzIpDEJ1Z2lzIChFVzEyKRFCdWtpdCBCYXRvayAoTlMyKRJCdWtpdCBHb21iYWsgKE5TMykSQnVvbmEgVmlzdGEgKENDMjIpEENhbGRlY290dCAoQ0MxNykUQ2hhbmdpIEFpcnBvcnQgKENHMikVQ2hpbmVzZSBHYXJkZW4gKEVXMjUpE0Nob2EgQ2h1IEthbmcgKE5TNCkVQ2l0eSBIYWxsIChFVzEzL05TMjUpD0NsZW1lbnRpIChFVzIzKRNDb21tb253ZWFsdGggKEVXMjApDERha290YSAoQ0M4KRZEaG9ieSBHaGF1dCAoQ0MxL05TMjQpDERvdmVyIChFVzIyKQ9Fc3BsYW5hZGUgKENDMykLRXVub3MgKEVXNykKRXhwbyAoQ0cxKRJGYXJyZXIgUm9hZCAoQ0MyMCkTSGFyYm91ckZyb250IChDQzI5KRRIYXcgUGFyIFZpbGxhIChDQzI1KRZIb2xsYW5kIFZpbGxhZ2UgKENDMjEpD0pvbyBLb29uIChFVzI5KRZKdXJvbmcgRWFzdCAoRVcyNC9OUzEpDkthbGxhbmcgKEVXMTApD0tlbWJhbmdhbiAoRVc2KRFLZW50IFJpZGdlIChDQzI0KQ1LaGF0aWIgKE5TMTQpDEtyYW5qaSAoTlM2KRRMYWJyYWRvciBQYXJrIChDQzI3KQ9MYWtlc2lkZSAoRVcyNikPTGF2ZW5kYXIgKEVXMTEpE0xvcm9uZyBDaHVhbiAoQ0MxNCkRTWFjUGhlcnNvbiAoQ0MxMCkVTWFyaW5hIEJheSAoTlMyNy9DRTEpGE1hcmluYSBTb3V0aCBQaWVyIChOUzI4KQ9NYXJzaWxpbmcgKE5TNykQTWFyeW1vdW50IChDQzE2KRFNb3VudGJhdHRlbiAoQ0M3KQ1OZXd0b24gKE5TMjEpFE5pY29sbCBIaWdod2F5IChDQzUpDU5vdmVuYSAoTlMyMCkQT25lLU5vcnRoIChDQzIzKQ5PcmNoYXJkIChOUzIyKRJPdXRyYW0gUGFyayAoRVcxNikUUGFzaXIgUGFuamFuZyAoQ0MyNikPUGFzaXIgUmlzIChFVzEpFFBheWEgTGViYXIgKENDOS9FVzgpDlBpb25lZXIgKEVXMjgpD1Byb21lbmFkZSAoQ0M0KRFRdWVlbnN0b3duIChFVzE5KRlSYWZmbGVzIFBsYWNlIChFVzE0L05TMjYpDlJlZGhpbGwgKEVXMTgpEFNlbWJhd2FuZyAoTlMxMSkQU2VyYW5nb29uIChDQzEzKQtTaW1laSAoRVczKQ9Tb21lcnNldCAoTlMyMykNU3RhZGl1bSAoQ0M2KQ9UYWkgU2VuZyAoQ0MxMSkOVGFtcGluZXMgKEVXMikRVGFuYWggTWVyYWggKEVXNCkUVGFuam9uZyBQYWdhciAoRVcxNSkUVGVsb2sgQmxhbmdhaCAoQ0MyOCkSVGlvbmcgQmFocnUgKEVXMTcpEFRvYSBQYXlvaCAoTlMxOSkPV29vZGxhbmRzIChOUzgpDVlldyBUZWUgKE5TNSkTWWlvIENodSBLYW5nIChOUzE1KQ1ZaXNodW4gKE5TMTMpFVAGU2VsZWN0A0FETQNBTEoDQU1LBENCTFkEQ0JGVANCREsEQ0JTSANCTkwEQ0JUTgNCREwEQ0JCUwNCR1MDQkJUA0JHQgRDQk5WBENDRFQDQ0dBA0NORwNDQ0sDQ1RIA0NMRQNDT00EQ0RLVARDREJHA0RWUgRDRVBOA0VVTgNYUE8EQ0ZSUgRDSEJGBENIUFYEQ0hMVgNKS04DSlVSA0tBTANLRU0EQ0tSRwNLVEIDS1JKBENMQkQDTEtTA0xWUgRDTFJDBENNUFMEQ01SQgNNU1ADTVNMBENNUk0EQ01CVANORVcEQ05DSANOT1YEQ09OSANPUkMDT1RQBENQUEoDUFNSBENQWUwDUE5SBENQTU4DUVVFA1JGUANSREgDU0JXBENTRVIDU0lNA1NPTQRDU0RNBENUU0cDVEFNA1ROTQNUUEcEQ1RMQgNUSUIDVEFQA1dETANZV1QDWUNLA1lJUxQrA1BnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZxYBZmQCAw9kFgICAw8PZBYEHwAFJHJldHVybiBjaGFuZ2VCdG5JbWFnZSh0aGlzLCAnb3ZlcicpOx8BBSNyZXR1cm4gY2hhbmdlQnRuSW1hZ2UodGhpcywgJ291dCcpO2RkZjQa0909x5cAnHC9VfOSv1vdtaM=",
            stnCode: "",
            stnName: "",
            ddlStation: stationcode
        },
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10

    }, function(error, response, body) {
        //console.log(body);
        if (!error && response.statusCode == 200) {
			direction = [];
			nextTrain = [];
			nextTrainFinalDtn = [];
			subTrain = [];
			subTrainFinalDtn = [];

			let $ = cheerio.load(body, {
				normalizeWhitespace: true
			});
			
			cheerioAdv.wrap(cheerio);
			cheerioTableparser($);
			let data = $("#gvTime").parsetable(false, false, true);
			
					
			console.log(data);
			if(data.length > 0) {
				//Get Direction: "CCL in the direction of HabourFront"
				let cnt = 0;
				$('p.align-left').each(function(idx, el) {
					let directionstr = cheerioAdv.compile('p.align-left:eq('+ idx + ')');
					directionstr = directionstr($).text().trim();
					if(directionstr.indexOf("in the direction of") != -1) {
						console.log('directionstr:' + directionstr + ':' + directionstr.indexOf("in the direction of"));
						direction[cnt] = directionstr;
						cnt++;
					}
				});
				console.log('direction:' + direction.length); console.log('');

				//Get nextTrain: "2 min(s)"
				cnt = 0;
				for(let i=0; i<data[0].length; i++) {
					let nextTrainstr = data[0][i].trim();
					if(nextTrainstr.indexOf("Next MRT") == -1) {
						if(nextTrainstr.indexOf("min(s)") != -1 || nextTrainstr.indexOf("N/A") != -1) {
							console.log('nextTrainstr:' + nextTrainstr);
							nextTrain[cnt] = nextTrainstr;
							cnt++;
						}
					}
				}
				console.log('nextTrain:' + nextTrain.length); console.log('');

				//Get nextTrainFinalDtn: "Jurong East"
				cnt = 0;
				for(let i=0; i<data[0].length; i++) {
					let nextTrainFinalDtnstr = data[0][i].trim();
					if(nextTrainFinalDtnstr.indexOf("Next MRT") == -1) {
						if(nextTrainFinalDtnstr.indexOf("min(s)") == -1 && nextTrainFinalDtnstr.indexOf("N/A") == -1) {
							console.log('nextTrainFinalDtnstr:' + nextTrainFinalDtnstr);
							nextTrainFinalDtn[cnt] = nextTrainFinalDtnstr;
							cnt++;
						}
					}
				}
				console.log('nextTrainFinalDtn:' + nextTrainFinalDtn.length); console.log('');

				//Get subTrain: "4 min(s)"
				cnt = 0;
				for(let i=0; i<data[1].length; i++) {
					let subTrainstr = data[1][i].trim();
					if(subTrainstr.indexOf("Subsequent MRT") == -1) {
						if(subTrainstr.indexOf("min(s)") != -1 || subTrainstr.indexOf("N/A") != -1) {
							console.log('subTrainstr:' + subTrainstr);
							subTrain[cnt] = subTrainstr;
							cnt++;
						}
					}
				}
				console.log('subTrain:' + subTrain.length); console.log('');

				//Get subTrainFinalDtn: "Jurong East"
				cnt = 0;
				for(let i=0; i<data[1].length; i++) {
					let subTrainFinalDtnstr = data[1][i].trim();
					if(subTrainFinalDtnstr.indexOf("Subsequent MRT") == -1) {
						if(subTrainFinalDtnstr.indexOf("min(s)") == -1 && subTrainFinalDtnstr.indexOf("N/A") == -1) {
							console.log('subTrainFinalDtnstr:' + subTrainFinalDtnstr);
							subTrainFinalDtn[cnt] = subTrainFinalDtnstr;
							cnt++;
						}
					}
				}
				console.log('subTrainFinalDtn:'+ subTrainFinalDtn.length); console.log('');
				callback('success');
			} else
				callback('error');
        }

    });
}

function generateJson(stationcode) {
	let json = "{";
	json = json + "  \"Arrivals\": {\n";
	json = json + "    \"" + stationcode + "\": {\n";

	for (let x=0; x<direction.length; x++) {
	
		json = json + "      \"platform" + x + "\": {\n";
		json = json + "        \"direction\": \"" + direction[x] + "\",\n";
		json = json + "        \"nextTrain\": \"" + nextTrain[x] + "\",\n";
		json = json + "        \"nextTrainFinalDtn\": \"" + nextTrainFinalDtn[x] + "\",\n";
		json = json + "        \"subTrain\": \"" + subTrain[x] + "\",\n";
		json = json + "        \"subTrainFinalDtn\": \"" + subTrainFinalDtn[x] + " \"\n";
		
		if (x == direction.length-1)
			json = json + "      }\n";
		else	
			json = json + "      },\n";
	}

	json = json + "    }\n";
	json = json + "  }\n";
	json = json + "}";
	return json;
}

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc) 

let limiter = new RateLimit({
  windowMs: 43800*60*1000, // 43800 minutes = 1 month.
  max: 50000, // limit each IP to 100 requests per windowMs 
  delayMs: 0 // disable delaying - full speed until the max limit is reached 
});
 
//  apply to all requests 
app.use(limiter);

app.set('port', (process.env.PORT || 8080))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am micro:bit Singapore')
})

app.get('/webhook/', function (req, res) {
	res.sendStatus(200);
})

app.post('/webhook/', function (req, res) {
	getKey(req.body.key, function(returnValue) {
		if(returnValue) {
			init(function(returnValue) {
				if (returnValue) {
					requestArrivalTiming(req.body.stationcode, function(returnValue1) {
						console.log(returnValue1);
						res.end(generateJson(req.body.stationcode));
					});
				}
			});
		} else
			res.sendStatus(500);
	});

	//res.sendStatus(200)
})

const port = process.env.PORT || 8080;

let server = app.listen(port, function () {
   let host = server.address().address
   let port = server.address().port

   console.log("App listening at http://%s:%s", host, port)
})
