var connection,
    settings,
    lastQry,
    mysql = require('mysql');
;

module.exports = function(connection_,settings_) {

    //Parse params
    if (!connection_) throw new Error('No connection specified!');
    else connection = connection_;

    if (settings_) settings = settings_;


    //Export API
    return {
        /**
         * Find all rows given to special params
         * @param req
         * @param res
         */
        findAll: function (req, res) {

            //To avoid errors, escape table
            req.params.table = escape(req.params.table);

            //Get all fields from table
            lastQry = connection.query('SHOW COLUMNS FROM ??', req.params.table, function (err, rows) {
                if (err) return sendError(res, err.code);


                var fields, limit, order, where;


                //All general Settings


                //Select only certain columns?
                if (typeof req.query[settings.paramPrefix + "fields"] !== "undefined" && typeof req.query[settings.paramPrefix + "fields"] == "string" && req.query[settings.paramPrefix + "fields"] !== "") {
                    var req_fields = escape(req.query[settings.paramPrefix + "fields"]);
                    if (checkIfFieldsExist(req_fields, rows)) {
                        fields = req_fields;
                    } else {
                        return sendError(res, "Failed to fetch all fields specified in _fields");
                    }
                } else {
                    fields = '*';
                }

                //Parse order by and order direction
                if (typeof req.query[settings.paramPrefix + "order"] !== "undefined" && typeof req.query[settings.paramPrefix + "order"] === "object") {
                    var orderObj = req.query[settings.paramPrefix + "order"];
                    var orderArr = [];
                    for (var order_field in orderObj) {
                        if (orderObj.hasOwnProperty(order_field)) {
                            if (checkIfFieldsExist(order_field, rows)) {
                                if (orderObj[order_field].toUpperCase() == "ASC" || orderObj[order_field].toUpperCase() == "DESC") {
                                    orderArr.push(req.params.table + ".`" + order_field + "` " + orderObj[order_field].toUpperCase());
                                } else {
                                    return sendError(res, "Order option for " + order_field + " in _order is invalid. Please use either ASC or DESC");
                                }
                            } else {
                                return sendError(res, "Failed to fetch " + order_field + " specified in _order");
                            }
                        }
                    }
                    order = orderArr.join(',');
                }

                //Parse limit
                if (typeof req.query[settings.paramPrefix + "limit"] !== "undefined" && typeof req.query[settings.paramPrefix + "limit"] === "string" && req.query[settings.paramPrefix + "limit"] !== "") {

                    var limitStr = req.query[settings.paramPrefix + "limit"];


                    var limitArr = limitStr.split(',');
                    if (limitArr.length > 2) {
                        return sendError(res, "Limit specificed in _limit is invalid. Limit does not allow more than 2 comma separated values");
                    }
                    for (var i = 0; i < limitArr.length; i++) {
                        var lim = parseInt(limitArr[i]);
                        if (isNaN(lim)) {
                            return sendError(res, "Limit specificed in _limit is invalid. Please use a comma to separate start and amount");
                        }
                        limitArr[i] = lim;
                    }

                    limit = limitArr.join(',');

                }


                //Parse all other get params as selector
                var whereArr = [];

                for (var q in req.query) {
                    if (req.query.hasOwnProperty(q)) {
                        if (q.substr(0, 1) !== settings.paramPrefix) {
                            if (checkIfFieldsExist(q, rows)) {

                                if (typeof req.query[q] === "string") {
                                    //If it is a simple string, the api assumes = as the operator
                                    whereArr.push(mysql.format('?? = ?', [q, escape(req.query[q])]));

                                } else if (typeof req.query[q] === "object") {

                                    for (var selector in req.query[q]) {
                                        if (req.query[q].hasOwnProperty(selector)) {
                                            var op, val = connection.escape(escape(req.query[q][selector]));
                                            //MYSQLify the operator
                                            switch (selector.toUpperCase()) {
                                                case 'GREAT':
                                                    op = "> ";
                                                    break;
                                                case 'SMALL':
                                                    op = "< ";
                                                    break;
                                                case 'EQGREAT':
                                                    op = '>= ';
                                                    break;
                                                case 'EQSMALL':
                                                    op = '<= ';
                                                    break;
                                                case 'IN':
                                                    op = 'IN (';
                                                    val = escape(req.query[q][selector]).split(',').map(function (item) {
                                                        return connection.escape(item);
                                                    }).join(',') + ')';
                                                    break;
                                                case 'LIKE':
                                                    op = 'LIKE ';                                            
                                                    break;
                                                case 'EQ':
                                                    op = '= ';
                                                    break;
                                                default:
                                                    op = '= ';
                                                    break;
                                            }
                                            whereArr.push(mysql.format('?? ' + op + val, [q]));
                                        }
                                    }

                                } else {
                                    return sendError(res, "Can't read parameter specified for the field " + q + " in the table " + req.params.table);
                                }


                            } else {
                                return sendError(res, "Can't find the field" + q + " in the table " + req.params.table);
                            }
                        }
                    }
                }

                if (whereArr.length > 0) {
                    where = whereArr.join(' AND ')
                }

                //Bring in MYSQL syntax
                fields = fields ? fields : '*';
                order = order ? 'ORDER BY ' + order : '';
                limit = limit ? 'LIMIT ' + limit : '';
                where = where ? 'WHERE ' + where : '';

                //Fire query
                lastQry = connection.query("SELECT " + fields + " FROM ?? " + where + " " + order + " " + limit, [req.params.table], function (err, rows) {
                    if (err) return sendError(res, err.code);
                    res.send({
                        result: 'success',
                        json: rows,
                        table: req.params.table,
                        length: rows.length
                    });
                });
            });
        },
        /**
         * find single entry by selector (default is primary key)
         * @param req
         * @param res
         */
        findById: function (req, res) {

            req.params.table = escape(req.params.table);

            //Request DB structure
            lastQry = connection.query('SHOW COLUMNS FROM ??', req.params.table, function (err, columns) {

                //Get primary key of table if not specified via query
                var field = findPrim(columns, req.query[settings.paramPrefix + 'field']);

                lastQry = connection.query('SELECT * FROM ?? WHERE ??.?? IN (' + req.params.id + ')', [req.params.table, req.params.table, field], function (err, rows) {
                    if (err) return sendError(res, err.code);
                    res.send({
                        result: 'success',
                        json: rows,
                        table: req.params.table,
                        length: rows.length
                    });
                });
            });

        },
        /**
         * Adds an element to the database.
         * @param req
         * @param res
         */
        addElement: function(req, res){

            var insertJson = {};

            //Request DB structure
            lastQry = connection.query('SHOW COLUMNS FROM ??', req.params.table , function (err, columns) {
                if (err) return sendError(res,err.code);

                var value;

                //Forced sync iterator
                var iterator = function (i) {
                    if (i >= columns.length) {
                        insertIntoDB();
                        return;
                    }

                    var dbField = columns[i];
                    var field = dbField.Field;

                    //Check required fields
                    if (dbField.Null === 'NO' && 
                        dbField.Default === '' && 
                        dbField.Extra !== 'auto_increment' && 
                        dbField.Extra.search('on update')===-1) {

                        //Check if field not set
                        if (undefOrEmpty(req.body[field])) {
                            return sendError(res,"Field " + field + " is NOT NULL but not specified in this request");
                        } else {
                            //Check if the set values are roughly okay
                            value = checkIfSentvaluesAreSufficient(req,dbField);
                            console.log(value);
                            if(value !== false) {
                                //Value seems okay, go to the next field
                                insertJson[field] = value;
                                iterator(i + 1);
                            } else {
                                return sendError(res,'Value for field ' + field + ' is not sufficient. Expecting ' + dbField.Type + ' but got ' + typeof req.body[field] );
                            }
                        }
                    }  else {
                        //Check for not required fields
                        //Skip auto_incremented fields
                        if(dbField.Extra === 'auto_increment') {
                            iterator(i + 1);
                        } else {
                            //Check if the field was provided by the client
                            var defined = false;
                            if(dbField.Default == "FILE") {
                                if(req.files.hasOwnProperty(dbField.Field)) {
                                    defined = true;
                                }
                            } else {
                                if(typeof req.body[field] !== "undefined") {
                                    defined = true;
                                }
                            }

                            //If it was provided, check if the values are okay
                            if(defined) {
                                value = checkIfSentvaluesAreSufficient(req,dbField);
                                if(value !== false) {
                                    insertJson[field] = value;
                                    iterator(i + 1);
                                } else {
                                    if(dbField.Default == "FILE") {
                                        return sendError(res, 'Value for field ' + field + ' is not sufficient. Either the file is to large or an other error occured');
                                    } else {
                                        return sendError(res, 'Value for field ' + field + ' is not sufficient. Expecting ' + dbField.Type + ' but got ' + typeof req.body[field]);
                                    }
                                }
                            } else {
                                //If not, don't mind
                                iterator(i + 1);
                            }

                        }
                    }

                };

                iterator(0); //start the async "for" loop

                /**
                 * When the loop is finished write everything in the database
                 */
                function insertIntoDB() {
                    lastQry = connection.query('INSERT INTO ?? SET ?', [req.params.table , insertJson] , function (err, rows) {
                        if (err) {
                            console.error(err);
                            res.statusCode = 500;
                            res.send({
                                result: 'error',
                                err: err.code
                            });
                        } else {
                            sendSuccessAnswer(req.params.table , res, rows.insertId);
                        }

                    });
                }
            });
        },
        /**
         * Update an existing row
         * @param req
         * @param res
         */
        updateElement: function(req, res) {
            var updateJson = {};
            var updateSelector = {};

            //Request database structure
            lastQry = connection.query('SHOW COLUMNS FROM ??', req.params.table , function (err, columns) {
                if (err) return sendError(res,err.code);

                //Check if the request is provided an select value
                if (typeof req.params.id === "undefined") {
                    return sendError(res,'Please specify an selector value for the fields ');
                } else {
                    updateSelector.value = req.params.id;
                    updateSelector.field = findPrim(columns,req.query[settings.paramPrefix + 'field']);
                }

                //If the user only wants to update files
                if( Object.keys(req.body).length == 0) {
                    req.body = req.files;
                }
                var value;
                var iterator = function (i) {
                    if (i >= columns.length || (typeof req.body.length === "undefined" && typeof req.files.length !== "undefined")) {
                        if(JSON.stringify(updateJson) !== '{}') {
                            updateIntoDB();
                        } else {
                            return sendError(res,'No Data received!');
                        }
                        return;
                    }
                    var dbField = columns[i];
                    var field = dbField.Field;
                    //Check if the current checked field is set
                    if(typeof req.body[field] !== "undefined" || (dbField.Default == 'FILE' && typeof req.files[field] !== "undefined") ) {
                        //First check if the field is required
                        if(dbField.Null == 'NO' && dbField.Extra != 'auto_increment') {
                            value = checkIfSentvaluesAreSufficient(req,dbField);
                            if(value !== false) {
                                updateJson[field] = value;
                                iterator(i + 1);
                            } else {
                                return sendError(res,"Not all 'NOT NULL' fields are filled ("+ field +" is missing)");
                            }
                        }  else {
                            //Check for not required fields
                            //Skip auto_incremented fields
                            if(dbField.Extra === 'auto_increment') {
                                iterator(i + 1);
                            } else {
                                //Check if the field was provided by the client
                                var defined = false;
                                if(dbField.Default == "FILE") {
                                    if(req.files.hasOwnProperty(dbField.Field)) {
                                        defined = true;
                                    }
                                } else {
                                    if(typeof req.body[field] !== "undefined") {
                                        defined = true;
                                    }
                                }

                                //If it was provided, check if the values are okay
                                if(defined) {
                                    value = checkIfSentvaluesAreSufficient(req,dbField);
                                    if(value !== false) {
                                        updateJson[field] = value;
                                        iterator(i + 1);
                                    } else {
                                        if(dbField.Default == "FILE") {
                                            return sendError(res, 'Value for field ' + field + ' is not sufficient. Either the file is to large or an other error occured');
                                        } else {
                                            return sendError(res, 'Value for field ' + field + ' is not sufficient. Expecting ' + dbField.Type + ' but got ' + typeof req.body[field]);
                                        }
                                    }
                                } else {
                                    //If not, don't mind
                                    iterator(i + 1);
                                }
                            }
                        }
                    } else {
                        iterator(i + 1);
                    }
                };

                iterator(0); //start the async "for" loop

                function updateIntoDB() {
                    //Yaaay, alle Tests bestanden gogo, insert!
                    lastQry = connection.query('UPDATE ?? SET ? WHERE ?? = ?', [req.params.table , updateJson, updateSelector.field, updateSelector.value] , function (err) {
                        if (err) return sendError(res,err.code);
                        sendSuccessAnswer(req.params.table , res, req.params.id, updateSelector.field);

                    });
                }
            });
        },
        deleteElement: function(req, res){

            var deleteSelector = {};

            lastQry = connection.query('SHOW COLUMNS FROM ??', req.params.table , function (err, columns) {
                if (err) return sendError(res,err.code);

                //Check if selector is sent
                if (typeof req.params.id === "undefined") {
                    return sendError(res,'You have to specify an ID to update an entry at /api/table/ID');
                } else {
                    deleteSelector.field = findPrim(columns,req.query[settings.paramPrefix + 'field']);
                    deleteSelector.value = req.params.id;
                }

                lastQry = connection.query('DELETE FROM ?? WHERE ?? = ?', [req.params.table, deleteSelector.field, deleteSelector.value] , function (err, rows) {
                    if (err) return sendError(res,err.code);

                    if(rows.affectedRows > 0) {
                        res.send({
                            result: 'success',
                            json: {deletedID:req.params.id},
                            table: req.params.table
                        });
                    } else return sendError(res,'No rows deleted');

                });
            });
        }
    }
};

/**
 * Send the edited element to the requester
 * @param table
 * @param res
 * @param id
 * @param field
 */

function sendSuccessAnswer(table, res, id, field) {
    if(typeof field === "undefined") {
        if(id === 0) {
            //Just assume that everything went okay. It looks like a non numeric primary key.
            res.send({
                result: 'success',
                table: table
            });
            return;
        } else {
            field = "id";
        }
    }
    lastQry = connection.query('SELECT * FROM ?? WHERE ?? = ?', [table, field, id] , function (err, rows) {
        if (err) {
            sendError(res, err.code)
        } else {
            res.send({
                result: 'success',
                json: rows,
                table: table
            });
        }
    });
}

/**
 * check if object is undefined or empty
 * @param obj
 * @returns {boolean}
 */

function undefOrEmpty(obj) {
    return !!(typeof obj === 'undefined' || obj === null || obj === undefined || obj === '');
}

/**
 * Check roughly if the provided value is sufficient for the database field
 * @param req
 * @param dbField
 * @returns {*}
 */

function checkIfSentvaluesAreSufficient(req,dbField) {
    if(dbField.Default == 'FILE') {
        //For 'File' fields just return the link ot the file
        if(req.files.hasOwnProperty(dbField.Field)) {

            var file = req.files[dbField.Field].hasOwnProperty('name') ? req.files[dbField.Field] : req.files[dbField.Field][0];

            if(settings.maxFileSize !== -1 && file.size > settings.maxFileSize) {
                return false;
            }

            return file.name;

        } else {
            return false;
        }
    } else {
        if (req.body[dbField.Field] === null || typeof req.body[dbField.Field] == "undefined") {
            return dbField.Null == "YES" ? null : false;
        }
        //Normle Werte
        if((dbField.Type.indexOf("int") != -1 || dbField.Type.indexOf("float") != -1 || dbField.Type.indexOf("double") != -1 )) {
            return !isNaN(req.body[dbField.Field]) ? req.body[dbField.Field] : false;
        } else if(typeof req.body[dbField.Field] === 'string') {
            return escape(req.body[dbField.Field]);
        }
        return false;
    }
}

/**
 * Credits to Paul d'Aoust @ http://stackoverflow.com/questions/7744912/making-a-javascript-string-sql-friendly
 * @param str
 * @returns {string}
 */

function escape (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
            case "%":
                return "%";
        }
    });
}

/**
 * Search in DB if the field(s) exist
 * @param fieldStr
 * @param rows
 * @returns {boolean}
 */

function checkIfFieldsExist(fieldStr,rows) {

    var ret = true;

    if(fieldStr.search(',') > -1 ) {
        var fieldArr = fieldStr.split(',');
        fieldArr.forEach(function (field) {
            if(ret) {
                if(rows.filter(function (r) {return r.Field === field;}).length == 0) {
                    ret = false;
                }
            }
        });
    } else {
        if(rows.filter(function (r) {return r.Field === fieldStr;}).length == 0) {
            ret = false;
        }
    }

    return ret;
}

/**
 * Send error messsage to the user
 * @param res
 * @param err
 */

function sendError(res,err) {
    console.error(err);
    // also log last executed query, for easier debugging
    console.error(lastQry.sql);
    res.statusCode = 500;
    res.send({
        result: 'error',
        err:    err
    });
}

/**
 * Get primary key, or if specified
 * @param columns
 * @param field
 * @returns {*}
 */

function findPrim(columns,field) {

    var primary_keys = columns.filter(function (r) {return r.Key === 'PRI';});

    //for multiple primary keys, just take the first
    if(primary_keys.length > 0) {
        return primary_keys[0].Field;
    }

    //If the provided field is a string, we might have a chance
    if(typeof field === "string") {
        if(checkIfFieldsExist(field,columns)) {
            return escape(field);
        }
    }

    //FALLBACK
    return "id";
}
