// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var msgSchema = mongoose.Schema({

    msgDetails              : {
        msg                 : String,
        selector            : Number,
        created_at          : Date
    }
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Message', msgSchema);
