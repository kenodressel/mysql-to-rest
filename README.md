# mysql-to-rest


mysql-to-rest is a module to map a MySQL-DB to an REST API. 

The foundation for this module is the express framework, as well as the mysql package for the DB connection.

## API

#### Installation

`$ npm install mysql-to-rest`

#### Usage

First load express and mysql

```js
var express = require('express');
var mysql = require('mysql');
var mysql-to-rest  = require('mysql-to-rest');
var app = express();
```

Then open your DB connection. Find more [here](https://github.com/felixge/node-mysql/#introduction)

When all dependencies are up and ready, init the API like this:

```js
mysql-to-rest(app,connection);
```

