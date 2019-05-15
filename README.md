# themost-adapters
MOST Web Framework 2.0 Codename Blueshift data adapters

This repository contains a set of database adapters available for developing applications and services under [MOST Web Framework 2.0 Codename Blueshift](https://github.com/themost-framework/themost)

[SQLite Database Adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/sqlite)

    npm install @themost/sqlite

Register SQLite adapter:

    "adapterTypes": [
        ...
          { "name":"SQLite Data Adapter", "invariantName": "sqlite", "type":"@themost/sqlite" }
        ...
        ],
    adapters: [
        ...
        { 
            "name":"local-db", "invariantName":"sqlite", "default":true,
            "options": {
                database:"db/local.db"
            }
        }
        ...
    ]
}


[MySQL Database Adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/mysql)

    npm install @themost/mysql

Register MySQL adapter:

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

[MSSQL Database Adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/mssql)

    npm install @themost/mssql

Register MSSQL adapter:

    "adapterTypes": [
        ...
        { "name":"MSSQL Data Adapter", "invariantName": "mssql", "type":"@themost/mssql" }
        ...
    ],
    adapters: [
        ...
        { "name":"development", "invariantName":"mssql", "default":true,
            "options": {
              "server":"localhost",
              "user":"user",
              "password":"password",
              "database":"test"
            }
        }
        ...
    ]

[H2 Database Adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/h2)

    npm install @themost/h2

Register H2 adapter:

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

[Oracle Database Adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/oracle)

    npm install @themost/oracle
    
Register Oracle adapter:

    "adapterTypes": [
        ...
        { "name":"Oracle Data Adapter", "invariantName": "oracle", "type":"@themost/oracle" }
        ...
    ],
    adapters: [
        ...
        { "name":"development", "invariantName":"oracle", "default":true,
            "options": {
              "host":"localhost",
              "port":1521,
              "user":"user",
              "password":"password",
              "service":"orcl",
              "schema":"PUBLIC"
            }
        }
        ...
    ]

[PostgreSQL Database Adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/pg)

    npm install @themost/pg

Register PostgreSQL adapter:

    "adapterTypes": [
            ...
            { "name":"PostgreSQL Data Adapter", "invariantName": "postgres", "type":"@themost/pg" }
            ...
        ],
    adapters: {
        "postgres": { "name":"local-db", "invariantName":"postgres", "default":true,
            "options": {
              "host":"localhost",
              "post":5432,
              "user":"user",
              "password":"password",
              "database":"db"
            }
    }
}

[Generic data connection pooling adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/pool)

    npm install @themost/pool

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



