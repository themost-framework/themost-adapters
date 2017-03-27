most-data-pg
===========

Most Web Framework PostgreSQL Adapter

##Install

$ npm install most-data-pg

##Usage

Register PostgreSQL adapter on app.json as follows:

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

If you are intended to use PostgreSQL adapter as the default database adapter set the property "default" to true. 

