// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var groupSchema = mongoose.Schema({

    groupDetails            : {
        userId              : String,
        groupName           : String,
        groupDesc           : String,
        created_at          : Date
    }
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Group', groupSchema);