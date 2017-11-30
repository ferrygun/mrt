var fs = require('fs');
var array = [];
var BBCMicrobit = require('bbc-microbit')
var BUTTON_VALUE_MAPPER = ['Not Pressed', 'Pressed', 'Long Press'];
var index = -1;
var stationname;
var sationcode;
var fileurl = '/home/pi/pylcdsysinfo/data.txt';

fs.readFile('mrt.txt', function(err, data) {
    if(err) throw err;
    array = data.toString().split("\n");
    
    connectmbit(array);

});

function connectmbit(array) {
  console.log('Scanning for microbit');
  BBCMicrobit.discover(function(microbit) {
    console.log('\tdiscovered microbit: id = %s, address = %s', microbit.id, microbit.address);

    microbit.on('disconnect', function() {
      console.log('\tmicrobit disconnected!');
      process.exit(0);
    });

    microbit.on('buttonAChange', function(value) {
      console.log('\ton -> button A change: ', BUTTON_VALUE_MAPPER[value]);

      if(value == 1) {
                
        if (index >= array.length-1)
            index = 0;
        else
            index += 1;

        stationname = array[index].split('=')[0].trim();
        stationcode = array[index].split('=')[1].trim();
        console.log(stationname + ':' + stationcode + ':' + index);

        fs.writeFile(fileurl, stationname + '=' + stationcode, function(err) {
            if(err) {
                return console.log(err);
            }

            console.log("The file was saved!");
        }); 

      }

    });

    microbit.on('buttonBChange', function(value) {
      console.log('\ton -> button B change: ', BUTTON_VALUE_MAPPER[value]);
      if(value == 1) {
                
        if (index <= 0)
          index = array.length-1
        else
          index -=1

        stationname = array[index].split('=')[0].trim();
        stationcode = array[index].split('=')[1].trim();
        console.log(stationname + ':' + stationcode + ':' + index);
        fs.writeFile(fileurl, stationname + '=' + stationcode, function(err) {
            if(err) {
                return console.log(err);
            }

            console.log("The file was saved!");
        }); 
        
      }
    });

    console.log('connecting to microbit');
    microbit.connectAndSetUp(function() {
      console.log('\tconnected to microbit');

      console.log('subscribing to buttons');
      // to only subscribe to one button use:
      //   microbit.subscribeButtonA();
      // or
      //   microbit.subscribeButtonB();
      microbit.subscribeButtons(function() {
        console.log('\tsubscribed to buttons');
      });
    });
  });
}

