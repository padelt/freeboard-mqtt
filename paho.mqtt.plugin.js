// # A Freeboard Plugin that uses the Eclipse Paho javascript client to read MQTT messages

(function()
{
	// ### Datasource Definition
	//
	// -------------------
	freeboard.loadDatasourcePlugin({
		"type_name"   : "paho_mqtt",
		"display_name": "Paho MQTT",
        "description" : "Receive data from an MQTT server.",
		"external_scripts" : [
			"<full address of the paho mqtt javascript client>"
		],
		"settings"    : [
			{
				"name"         : "server",
				"display_name" : "MQTT Server",
				"type"         : "text",
				"description"  : "Hostname for your MQTT Server",
                "required" : true
			},
			{
				"name"        : "port",
				"display_name": "Port",
				"type"        : "number", 
				"description" : "The port to connect to the MQTT Server on",
				"required"    : true
			},
			{
				"name"        : "use_ssl",
				"display_name": "Use SSL",
				"type"        : "boolean",
				"description" : "Use SSL/TLS to connect to the MQTT Server",
				"default_value": true
			},
            {
            	"name"        : "client_id",
            	"display_name": "Client Id",
            	"type"        : "text",
            	"default_value": "",
            	"required"    : false
            },
            {
            	"name"        : "username",
            	"display_name": "Username",
            	"type"        : "text",
            	"default_value": "",
            	"required"    : false
            },
            {
            	"name"        : "password",
            	"display_name": "Password",
            	"type"        : "text",
            	"default_value": "",
            	"required"    : false
            },
            {
            	"name"        : "topic",
            	"display_name": "Topic",
            	"type"        : "text",
            	"description" : "The topic to subscribe to",
            	"required"    : true
            },
            {
            	"name"        : "json_data",
            	"display_name": "JSON messages?",
            	"type"        : "boolean",
            	"description" : "If the messages on your topic are in JSON format they will be parsed so the individual fields can be used in freeboard widgets",
            	"default_value": false
            }
		],
		// **newInstance(settings, newInstanceCallback, updateCallback)** (required) : A function that will be called when a new instance of this plugin is requested.
		// * **settings** : A javascript object with the initial settings set by the user. The names of the properties in the object will correspond to the setting names defined above.
		// * **newInstanceCallback** : A callback function that you'll call when the new instance of the plugin is ready. This function expects a single argument, which is the new instance of your plugin object.
		// * **updateCallback** : A callback function that you'll call if and when your datasource has an update for freeboard to recalculate. This function expects a single parameter which is a javascript object with the new, updated data. You should hold on to this reference and call it when needed.
		newInstance   : function(settings, newInstanceCallback, updateCallback)
		{
			newInstanceCallback(new mqttDatasourcePlugin(settings, updateCallback));
		}
	});

	var mqttDatasourcePlugin = function(settings, updateCallback)
	{
 		var self = this;
		var data = {};

		var currentSettings = settings;
		// If defined, will show status in color-coded bar on top of the page.
		// If you change the element ID, remember to change the CSS, too.
		var idStatusElement = "mqttconnectionstatus";
		var selectorStatusElement = "#"+idStatusElement;

		function onConnect() {
		    console.log("Connected");
		    if (selectorStatusElement) {
		        $(selectorStatusElement).css('background-color', 'green');
		        $(selectorStatusElement).animate({
		            "margin-top": "0px"
		        }, 500, function() {
		            $(this).delay(5000).animate({
		                "margin-top": "-30px"
		            }, 500);
		        });
		        $(selectorStatusElement).html('CONNECTED');
		    }
		    
		    client.subscribe(currentSettings.topic);
		};

		function onFailure(responseObject) {
		    console.log("Failure");
		    if (selectorStatusElement) {
		        $(selectorStatusElement).css('background-color', 'red');
		        $(selectorStatusElement).html('Failed to connect... Retrying.');
		        $(selectorStatusElement).animate({
		            "margin-top": "0px"
		        });
		    }
		    console.log("Will try to connect in 3s.");
		    window.setTimeout(self.doConnect, 3000);
		};
		
		function onConnectionLost(responseObject) {
		    if (selectorStatusElement) {
		        $(selectorStatusElement).css('background-color', 'red');
		        $(selectorStatusElement).animate({
		            "margin-top": "-30px"
		        });
		    }
		    if (responseObject.errorCode !== 0)
		        console.log("onConnectionLost:"+responseObject.errorMessage);
		    else
		        console.log("onConnectionLost");
		    self.doConnect();
		};

		function onMessageArrived(message) {
			data.topic = message.destinationName;
			if (currentSettings.json_data) {
				data.msg = JSON.parse(message.payloadString);
			} else {
				data.msg = message.payloadString;
			}
			updateCallback(data);
		};


		// Allow datasource to post mqtt messages
		self.send = function(value) {
			if (client.isConnected()) {
				if (typeof(value) == 'boolean') value = value ? 1 : 0;
				var message = new Paho.MQTT.Message(String(value));
		        message.destinationName = currentSettings.topic;
		        client.send(message);
			}
		}


		// **onSettingsChanged(newSettings)** (required) : A public function we must implement that will be called when a user makes a change to the settings.
		self.onSettingsChanged = function(newSettings)
		{
		    currentSettings = newSettings;
		    data = {};
		    client.disconnect();

		    // Reconnect will be automatic.
		    /*
		    client.connect({onSuccess:onConnect,
		                    userName: currentSettings.username,
		                    password: currentSettings.password,
		                    useSSL: currentSettings.use_ssl});
		    */
		}

		// **updateNow()** (required) : A public function we must implement that will be called when the user wants to manually refresh the datasource
		self.updateNow = function()
		{
			// Don't need to do anything here, can't pull an update from MQTT.
		}

		self.doConnect = function() {
		    client.connect({onSuccess:onConnect, 
		                    onFailure:onFailure,
		                    userName: currentSettings.username,
		                    password: currentSettings.password,
		                    useSSL: currentSettings.use_ssl});
		};


		// **onDispose()** (required) : A public function we must implement that will be called when this instance of this plugin is no longer needed. Do anything you need to cleanup after yourself here.
		self.onDispose = function()
		{
		    if (client.isConnected()) {
		        client.disconnect();
		    }
		    client = {};
		}

		// Append a random string to the client_id to allow multiple dashboards to share one client_id-setting.
		var idSuffix = 'xxxxxxxxxx'.replace(/[xy]/g, function(c) {
		    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		    return v.toString(16);
		});

		// Add DOM element.
		if (selectorStatusElement) {
		    var content = '<style>'+
		        selectorStatusElement+' {'+
		        '    width: 100%;'+
		        '    height: 40px;'+
		        '    line-height: 35px;'+
		        '    margin-top: -30px;'+
		        '    background-color: #AAA;'+
		        '    color: white;'+
		        '    text-align: center;'+
		        '}'+
		        '#toggle-header {'+
		        '    margin-left: auto;'+
		        '    margin-right: initial;'+
		        '    margin-top: 0;'+
		        '    margin-bottom: 0;'+
		        '}'+
		    '</style>'+
		    '<div id="'+idStatusElement+'"></div>';
		    $(content).insertBefore("#board-content");
		}

		var client = new Paho.MQTT.Client(currentSettings.server,
		                                currentSettings.port, 
		                                currentSettings.client_id+"_"+idSuffix);
		client.onConnectionLost = onConnectionLost;
		client.onMessageArrived = onMessageArrived;
		self.doConnect();
	}
}());
