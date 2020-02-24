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
- adapter:
The name of the data adapter to be linked with this pool adapter.

@themost/pool uses [generic-pool](https://github.com/coopernurse/node-pool). 
Read more about other options here:
[generic-pool documentation](https://github.com/coopernurse/node-pool#documentation)
 

