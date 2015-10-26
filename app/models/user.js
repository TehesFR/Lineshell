// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var userSchema = mongoose.Schema({

    resetPasswordToken: String,
    resetPasswordExpires: Date,
    lastConnectionDate : Date,

    local            : {
        email        : String,
        password     : String,
        created_at   : Date,
        country      : String
    },
    facebook         : {
        id           : String,
        token        : String,
        email        : String,
        name         : String,
        created_at   : Date
    },
    twitter          : {
        id           : String,
        token        : String,
        displayName  : String,
        username     : String,
        created_at   : Date
    },
    google           : {
        id           : String,
        token        : String,
        email        : String,
        name         : String,
        created_at   : Date
    },
    keys             : {
        pub          : String,
        created_at   : Date
    },
    settings         : {
        timezone     : String
    },
    plan             : {
        customer_id  : String,
        plan_id      : String,
        timeout      : Number,
        created_at   : Date
    },
    gauth           : {
        key          : Object,
        activated    : Boolean
    }
});

// generating a hash
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
