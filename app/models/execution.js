// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var executionSchema = mongoose.Schema({

 executionDetails            : {
        userId               : String,
        scriptId             : String,
        scriptName           : String,
        serverId             : String,
        serverName           : String,
        groupId              : String,
        groupName            : String,
        executionStdout      : [String],
        executionStderr      : [String],
        executionServ        : [String],
        created_at           : Date,
        withArgs             : String,
        matches              : [String],
        tabArgs              : [String],
        notes                : String
    }
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Execution', executionSchema);
