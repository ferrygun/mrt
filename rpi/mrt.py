import requests
import json
import time
import datetime
import threading

from pylcdsysinfo import BackgroundColours, TextColours, TextAlignment, TextLines, LCDSysInfo
from time import sleep

def setInterval(func,time):
    e = threading.Event()
    while not e.wait(time):
        func()

def getArrivalTime(stationcode, stationname):
	url = 'https://smrtfd18.herokuapp.com/webhook'
	payload = {'stationcode': stationcode, 'key': 'MEtSAm6Tzl5PPT3bmLq1JqkFvcpXmKL2M7EWbq15'}

	r = requests.post(url, data=payload)

	output = json.loads(r.content)

	nextTrain = ''
	subTrain = ''
	nextTrainFinalDtn = ''
	j = 0

	d = LCDSysInfo()
	d.clear_lines(TextLines.ALL, BackgroundColours.BLACK)
	d.dim_when_idle(False)
	d.set_brightness(127)
	d.save_brightness(127, 255)
	d.set_text_background_colour(BackgroundColours.BLACK)

	for rows in output['Arrivals']:
		for x in output['Arrivals'][rows]:
			if x > 0:
				for y in output['Arrivals'][rows][x]:
					print x, ':', y, ':', output['Arrivals'][rows][x][y]
					
					if (y == 'nextTrainFinalDtn'):
						nextTrainFinalDtn = output['Arrivals'][rows][x][y].strip()
						j += 1

					if (y == 'nextTrain'):
						str_ = str(output['Arrivals'][rows][x][y])
						nextTrain =  filter(str.isdigit, str_)
						j += 1

					if (y == 'subTrain'):
						str_ = str(output['Arrivals'][rows][x][y])
						subTrain = filter(str.isdigit, str_)
						j += 1

					if (j == 3):
						print 'To: ', nextTrainFinalDtn, '> ', nextTrain, ' ', subTrain 
						
						if (nextTrainFinalDtn != ''):
							clock_str = str(datetime.datetime.now()).split('.')[0]
							
							d.display_text_on_line(1, stationname, False, TextAlignment.CENTRE, TextColours.PINK)	
							d.display_text_on_line(2, '---------------------------------------', False, TextAlignment.CENTRE, TextColours.PINK)
							d.display_text_on_line(3, 'To ' + nextTrainFinalDtn, False, TextAlignment.CENTRE, TextColours.GREEN) 
							d.display_text_on_line(4, 'Next train: ' + nextTrain + ' min(s)', False, TextAlignment.LEFT, TextColours.YELLOW)
							d.display_text_on_line(5, 'Sub. train: ' + subTrain + ' min(s)', False, TextAlignment.LEFT, TextColours.CYAN)
							d.display_text_on_line(6, clock_str, False, TextAlignment.CENTRE, TextColours.WHITE)

							time.sleep(5)
							d.clear_lines(TextLines.ALL, BackgroundColours.BLACK)
						
						j = 0


class ThreadJob(threading.Thread):
    def __init__(self,callback,event,interval):
        '''runs the callback function after interval seconds

        :param callback:  callback function to invoke
        :param event: external event for controlling the update operation
        :param interval: time in seconds after which are required to fire the callback
        :type callback: function
        :type interval: int
        '''
        self.callback = callback
        self.event = event
        self.interval = interval
        super(ThreadJob,self).__init__()

    def run(self):
        while not self.event.wait(self.interval):
            self.callback()


def foo():
    myvars = {}
    with open('data.txt') as myfile:
    	for line in myfile:
    		name, var = line.partition("=")[::2]
    		myvars[name.strip()] = var

    stationcode = ''
    stationname = ''
    for row in myvars:
    	stationname = row.strip()
    	stationcode = myvars[row].strip()
    if(stationcode != '' and stationname != ''):
    	getArrivalTime(stationcode, stationname)

def main():
	event = threading.Event()
	k = ThreadJob(foo,event,5)
	k.start()

if __name__ == '__main__':
   main()
