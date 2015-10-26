// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var scriptSchema = mongoose.Schema({

    scriptDetails            : {
        userId               : String,
        scriptName           : String,
        scriptNotes          : String,
        scriptContent        : String,
        created_at           : Date,
        withArgs             : Boolean
    }
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Script', scriptSchema);
