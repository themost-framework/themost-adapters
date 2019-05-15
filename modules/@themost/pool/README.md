# @themost/pool
Most Web Framework Data Pool Adapter
## Install
    npm install @themost/pool
## Usage
Register Generic Pool Adapter on app.json as follows:

    "adapterTypes": [
        ...
        { "name":"...", "invariantName": "...", "type":"..." },
        { "name":"Pool Data Adapter", "invariantName": "pool", "type":"@themost/pool" }
        ...
    ],
    adapters: [
        ...
        { "name":"development", "invariantName":"...", "default":false,
            "options": {
              "server":"localhost",
              "user":"user",
              "password":"password",
              "database":"test"
            }
        },
        { "name":"development_with_pool", "invariantName":"pool", "default":true,
                    "options": {
                      "adapter":"development"
                    }
                }
        ...
    ]

The generic pool adapter will try to instantiate the adapter defined in options.adapter property.

# Options
### adapter:
The name of the data adapter to be linked with this pool adapter.
### size:
The number of the data adapters that are going to be pooled for new connections. The default value is 25.
### timeout:
A number of milliseconds to wait for getting a new data adapter. If this timeout exceeds, a timeout error will occured. The default value is 30000.
### lifetime
A number of milliseconds which indicates whether or not a pooled data adapter will be automatically ejected from data adapters' collection. The default value is 1200000.
