// server.js

// set up ======================================================================
// get all the tools we need
var express      = require('express');
var favicon      = require('serve-favicon');
var app          = express();
app.use(favicon(__dirname + '/static/favicon.ico'));

var port         = process.env.PORT || 8080;
var mongoose     = require('mongoose');
var passport     = require('passport');
var flash        = require('connect-flash');

var fse          = require('fs-extra');
var https        = require('https');


var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

var async        = require('async');

var configDB     = require('./config/database.js');
var moment       = require('moment-timezone');
var timeout      = require('connect-timeout');
var helmet       = require('helmet');

// configuration ===============================================================
mongoose.connect(configDB.url); // connect to our database

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({ secret: 'thisislineshellmanagementtoolappsecret' })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport
app.use("/static", express.static(__dirname + '/static'));

app.use(function(req, res, next){
    res.status(404).render('404.ejs');
});

// HTTP ======================================================================
app.listen(port);
console.log('Server started on port ' + port);
