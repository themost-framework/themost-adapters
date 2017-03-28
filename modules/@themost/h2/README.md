# @themost/h2
Most Web Framework H2 Data Adapter
##Install
$ npm install @themost/h2
##Usage
Register H2 adapter on app.json as follows:

    "adapterTypes": [
        ...
        { "name":"H2 Data Adapter", "invariantName": "h2", "type":"@themost/h2" }
        ...
    ],
    adapters: [
        ...
        { "name":"development", "invariantName":"h2", "default":true,
            "options": {
               "path":"~/h2/test",
               "user":"SA",
               "password":""
           }
        },
        { "name":"server", "invariantName":"h2", "default":false,
                    "options": {
                       "database":"test",
                       "host":"localhost",
                       "port":9090,
                       "user":"SA",
                       "password":"",
                       "pool":100
                   }
                }
        ...
    ]

If you are intended to use H2 data adapter as the default database adapter set the property "default" to true.
