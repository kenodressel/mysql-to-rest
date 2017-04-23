# mysql-to-rest

mysql-to-rest is a module to map a MySQL-DB to an REST API. 

The foundation for this module is the express framework, as well as the mysql package for the DB connection.

## API

### Installation

`$ npm install mysql-to-rest`

First load express and mysql

```js
var express = require('express');
var mysql = require('mysql');
var mysqltorest  = require('mysql-to-rest');
var app = express();
```

Then open your DB connection. Find more [here](https://github.com/felixge/node-mysql/#introduction). (You can also use `mysql.createPool()` to create a pool of connections and pass that to `mysql-to-rest`.)

When all dependencies are up and ready, init the API like this:

```js
var api = mysqltorest(app,connection);
//Dont forget to start the server
app.listen(8000);
```

### Usage

Once the app is up and running you have the following options:

#### GET Table

##### Request

`GET /api/:table`

##### Result

```json
{
    "result": "success",
    "json": [
        {
            "id": 1,
            "col1": 15,
            "col2": null,
            "col3": "String"
        }
    ],
    "table": "test",
    "length": 1
}
```

##### Params

You can further specify your Requests with GET params. As an example:

`GET /api/:table?_limit=0,10&_order[id]=DESC&id[GREAT]=4`

##### General params

**Important: The general params are noted with the prefix you can define in the options. Default is underscore. Eg: \_limit**

All general params are as close to the MYSQL feeling as it would make sense in a web API. So it really helps if you understand MYSQL Syntax.

* `limit=` Takes either one or two comma separated integers. Acts like specified [here](https://dev.mysql.com/doc/refman/5.0/en/select.html)
* `order[column]=` Takes either ASC or DESC. Orders the result ASC|DESC according to the column. Acts like specified [here](https://dev.mysql.com/doc/refman/5.0/en/select.html)
* `fields=` Takes one or more comma separated columns as an argument. Filters the results to only show the specified columns. Acts like specified [here](https://dev.mysql.com/doc/refman/5.0/en/select.html)

##### Field specific params

Here you can apply further conditions to your selection.

Syntax: `column=value` or `column[operator]=value`

The first option is simple and can be used to select entries where the column equals (=) the provided value.

In the second option one can specify exactly the operator which should be used. Full list:

* `GREAT` results in \>
* `SMALL` results in \<
* `EQGREAT`results in \>=
* `EQSMALL`results in \<=
* `LIKE`results in LIKE
* `EQ`results in =

---

#### GET Row

##### Request

`GET /api/:table/:id`

##### Result

For results and params see at [`GET /api/:table`](#get-table)

---

#### POST

##### Request

`POST /api/:table`

##### Result

This will return the created row like at [`GET /api/:table`](#get-table)

---

#### PUT

##### Request

`PUT /api/:table/:id`

##### Result

This will return the updated row like at [`GET /api/:table`](#get-table)

---

#### DELETE

##### Request

`DELETE /api/:table/:id`

##### Result

This will return the deleted id. Whereby the id is the first primary key of the table. Example:

```json
{
    "result": "success",
    "json": {
        "deletedID": "1"
    },
    "table": "test"
}
```

## Config

This line inits the api. You can provide a config object to adjust the settings to your need by adding an options object:

`mysqltorest(app,connection,options);`

If not specified, the following options will be used:

```js
var default_options = {
    uploadDestination:__dirname + '/uploads',
    allowOrigin:'*',
    maxFileSize:-1,
    apiURL:'/api',
    paramPrefix:'_'
};
```


The options consist of the following:

### Options

#### uploadDestination

This specifies the multer upload destination. The default is ` __dirname + '/uploads'`. For more read the [multer documentation](https://github.com/expressjs/multer).

#### allowOrigin

As the API sets some default headers this sets the Access-Control-Allow-Origin header. Provide the domain or url the API should be accessed by. Default is `*` so be careful!

#### maxFileSize

This checks the filesize of the uploaded files. The value is in bytes. Default (and off) is `-1`.

#### apiURL

Here the url to the api is specified. Default is `/api`.

#### paramPrefix

This is the query prefix for not select querys like order or limit.

### Functions

Currently there is only one API call:

`api.setAuth(function)`

#### function

Provide an express middleware to authenticate the requests to the api specifically. The following example shows the basic idea:

```js
api.setAuth(function(req,res,next) {
    if(req.isAuthenticated && req.method === 'GET'){
        next();
    } else {
        //Handle unauthorized access
    }
});
```


## MySQL Config

To make the setup as easy as possible mysql-to-rest reads almost all config directly form the database. This has two "pitfalls":

* `NOT NULL` Columns are seen as required. Even if they have a default value.
* If you want to upload a file. You have to do the following steps:
    * Create a varchar or text column.
    * Set the default value to `FILE`.

## Docker

A full version can be deployed using docker. (Thanks to @reduardo7)
https://hub.docker.com/r/reduardo7/db-to-api/
