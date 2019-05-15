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

[Oracle Database Adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/oracle)

[PostgreSQL Database Adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/pg)

[Generic data connection pooling adapter](https://github.com/themost-framework/themost-adapters/tree/master/modules/%40themost/pool)
