// BASE SETUP
// =============================================================================

// call the packages we need
var bodyParser      = require('body-parser');
var multer          = require('multer');

module.exports = function(app,connection,options) {

    if(!app) throw new Error('Please provide express to this module');

    //Parse Options
    options = options || {};
    options.uploadDestination = options.uploadDestination || __dirname + '/uploads/';   //Where to save the uploaded files
    options.allowOrigin = options.allowOrigin || '*';                                   //Sets the Access-Control-Allow-Origin header
    options.maxFileSize = options.maxFileSize || -1;                                    //Max filesize for uploads in bytes
    options.apiURL = options.apiURL || '/api';                                          //Url Prefix for API
    options.paramPrefix = options.paramPrefix || '_';                                   //Prefix for special params (eg. order or fields).

    app.use(bodyParser.urlencoded({ extended: false }) );
    app.use(multer({dest: options.uploadDestination }));

    //==============================================================================
    //Routing

    // Add headers
    app.use(function (req, res, next) {

        // Website you wish to allow to connect
        res.setHeader('Access-Control-Allow-Origin', options.allowOrigin);

        // Request methods you wish to allow
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');

        // Request headers you wish to allow
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

        // Set to true if you need the website to include cookies in the requests sent
        // to the API (e.g. in case you use sessions)
        res.setHeader('Access-Control-Allow-Credentials', true);

        // Pass to next layer of middleware
        next();
    });

    var ensureAuthenticated = function(req,res,next) {
        next();
    };

    var api = require('./controllers/api.js')(connection,{
        maxFileSize:options.maxFileSize,
        paramPrefix:options.paramPrefix
    });

    //Set actual routes
    app.get(options.apiURL + '/:table', ensureAuthenticated, api.findAll);
    app.get(options.apiURL + '/:table/:id', ensureAuthenticated, api.findById);
    app.post(options.apiURL + '/:table', ensureAuthenticated, api.addElement);
    app.put(options.apiURL + '/:table/:id', ensureAuthenticated, api.updateElement);
    app.delete(options.apiURL + '/:table/:id', ensureAuthenticated, api.deleteElement);


    //Export API
    return {
        setAuth:function(fnc) {
            ensureAuthenticated = fnc;
        }
    }
};