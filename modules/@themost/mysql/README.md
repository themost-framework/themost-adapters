# @themost/mysql
Most Web Framework MySQL Adapter
##Install
$ npm install @themost/mysql
##Usage
Register MySQL adapter on app.json as follows:

    "adapterTypes": [
        ...
        { "name":"MySQL Data Adapter", "invariantName": "mysql", "type":"@themost/mysql" }
        ...
    ],
    adapters: [
        ...
        { "name":"development", "invariantName":"mysql", "default":true,
            "options": {
              "host":"localhost",
              "port":3306,
              "user":"user",
              "password":"password",
              "database":"test"
            }
        }
        ...
    ]

If you are intended to use MySQL data adapter as the default database adapter set the property "default" to true.
