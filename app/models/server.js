// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var serverSchema = mongoose.Schema({

    serverDetails            : {
        userId               : String,
        serverName           : String,
        serverAddress        : String,
        serverPort           : Number,
        serverUsername       : String,
        serverTags           : String,
        serverGroups         : String,
        sshStatus            : Boolean,
        created_at           : Date
    }
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Server', serverSchema);
