// load all the things we need
// ONLY LOCAL ACCOUNTS ARE USED WITH THE ONPREMISE VERSION OF LINESHELL

var LocalStrategy    = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy  = require('passport-twitter').Strategy;
var GoogleStrategy   = require('passport-google-oauth').OAuth2Strategy;

// load up the user model
var User       = require('../app/models/user');

// load the auth variables
var configAuth = require('./auth'); // use this one for testing

module.exports = function(passport) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });

    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
    passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
    },
    function(req, email, password, done) {
        if (email)
            email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching

        // asynchronous
        process.nextTick(function() {
            User.findOne({ 'local.email' :  email }, function(err, user) {
                // if there are any errors, return the error
                if (err){
                      console.log(err);
                      return done(null, false, req.flash('loginMessage', 'Oops error! Please contact us if needed!'));
                }

                // if no user is found, return the message
                if (!user)
                    return done(null, false, req.flash('loginMessage', 'Oops! Wrong password or no user found.'));

                if (!user.validPassword(password))
                    return done(null, false, req.flash('loginMessage', 'Oops! Wrong password or no user found.'));

                // all is well, return user
                else
                    var moment = require('moment');
                    user.lastConnectionDate = moment().format();
                    user.save(function(err, user) {
                      if (err){
                            console.log(err);
                            return done(null, false, req.flash('loginMessage', 'Oops error! Please contact us if needed!'));
                      }
                        return done(null, user);
          					});
            });
        });

    }));

    // =========================================================================
    // LOCAL SIGNUP ADD ============================================================
    // =========================================================================
    passport.use('local-signup-add', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
    },
    function(req, email, password, done) {

        if (!req.user) {
          return done(null, false, req.flash('loginMessage', 'You need to create an account on the signup page!'));
        }else{

        if (email)
            email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching

        // asynchronous
        process.nextTick(function() {

            // if the user is logged in but has no local account...
            if ( !req.user.local.email ) {
                // ...presumably they're trying to connect a local account
                // BUT let's check if the email used to connect a local account is being used by another user
                User.findOne({ 'local.email' :  email }, function(err, user) {
                  if (err){
                        console.log(err);
                        return done(null, false, req.flash('loginMessage', 'Oops error! Please contact us if needed!'));
                  }

                    if (user) {
                        return done(null, false, req.flash('loginMessage', 'That email is already taken.'));
                        // Using 'loginMessage instead of signupMessage because it's used by /connect/local'
                    } else {
                        var user = req.user;
                        user.local.email = email;
                        user.local.password = user.generateHash(password);
                        user.local.country = req.body.country;
                        user.save(function (err) {
                          if (err){
                                console.log(err);
                                return done(null, false, req.flash('loginMessage', 'Oops error! Please contact us if needed!'));
                          }

                            return done(null,user);
                        });
                    }
                });
            } else {
                // user is logged in and already has a local account. Ignore signup. (You should log out before trying to create a new account, user!)
                return done(null, req.user);
            }

        });
      }
    }));

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
    },
    function(req, email, password, done) {

        if (email)
            email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching

        // asynchronous
        process.nextTick(function() {
            // if the user is not already logged in:
            if (!req.user) {
                User.findOne({ 'local.email' :  email }, function(err, user) {
                    // if there are any errors, return the error
                    if (err){
                          console.log(err);
                          return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                    }

                    // check to see if theres already a user with that email
                    if (user) {
                        return done(null, false, req.flash('signupMessage', 'That email is already taken.'));
                    } else {

                        // create the user
                        var newUser            = new User();

                        newUser.local.email    = email;
                        newUser.local.password = newUser.generateHash(password);
                        var moment = require('moment');
                        newUser.local.created_at = moment().format();
                        newUser.local.country = req.body.country;
                        newUser.plan.customer_id = "cus_007";
                        newUser.plan.plan_id = "Free";
                        newUser.plan.timeout = 1800000;

                        newUser.save(function(err) {
                          if (err){
                                console.log(err);
                                return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                          }

                            return done(null, newUser);

                        });
                    }

                });
            // if the user is logged in but has no local account...
            } else if ( !req.user.local.email ) {
                // ...presumably they're trying to connect a local account
                // BUT let's check if the email used to connect a local account is being used by another user
                User.findOne({ 'local.email' :  email }, function(err, user) {
                  if (err){
                        console.log(err);
                        return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                  }

                    if (user) {
                        return done(null, false, req.flash('loginMessage', 'That email is already taken.'));
                        // Using 'loginMessage instead of signupMessage because it's used by /connect/local'
                    } else {
                        var user = req.user;
                        user.local.email = email;
                        user.local.password = user.generateHash(password);
                        user.save(function (err) {
                          if (err){
                                console.log(err);
                                return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                          }

                            return done(null,user);
                        });
                    }
                });
            } else {
                // user is logged in and already has a local account. Ignore signup. (You should log out before trying to create a new account, user!)
                return done(null, req.user);
            }
        });
    }));

    // =========================================================================
    // FACEBOOK ================================================================
    // =========================================================================
    passport.use(new FacebookStrategy({

        clientID        : configAuth.facebookAuth.clientID,
        clientSecret    : configAuth.facebookAuth.clientSecret,
        callbackURL     : configAuth.facebookAuth.callbackURL,
        passReqToCallback : true // allows us to pass in the req from our route (lets us check if a user is logged in or not)

    },
    function(req, token, refreshToken, profile, done) {

        // asynchronous
        process.nextTick(function() {

            // check if the user is already logged in
            if (!req.user) {

                User.findOne({ 'facebook.id' : profile.id }, function(err, user) {
                  if (err){
                        console.log(err);
                        return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                  }

                    if (user) {

                        // if there is a user id already but no token (user was linked at one point and then removed)
                        if (!user.facebook.token) {
                            user.facebook.token = token;
                            user.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName;
                            user.facebook.email = (profile.emails[0].value || '').toLowerCase();

                            user.save(function(err) {
                              if (err){
                                    console.log(err);
                                    return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                              }

                                return done(null, user);
                            });
                        }
                        var moment = require('moment');
                        user.lastConnectionDate = moment().format();
                        user.save(function(err, user) {
                          if (err){
                                console.log(err);
                                return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                          }
                            return done(null, user); // user found, return that user
              					});
                    } else {
                        // if there is no user, create them
                        var newUser            = new User();

                        newUser.facebook.id    = profile.id;
                        newUser.facebook.token = token;
                        newUser.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName;
                        newUser.facebook.email = (profile.emails[0].value || '').toLowerCase();
                        var moment = require('moment');
                        newUser.facebook.created_at = moment().format();
                        newUser.plan.customer_id = "cus_007";
                        newUser.plan.plan_id = "Free";
                        newUser.plan.timeout = 1800000;

                        newUser.save(function(err) {
                          if (err){
                                console.log(err);
                                return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                          }

                            return done(null, newUser);
                        });
                    }
                });

            } else {
                // user already exists and is logged in, we have to link accounts
                var user            = req.user; // pull the user out of the session

                user.facebook.id    = profile.id;
                user.facebook.token = token;
                user.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName;
                user.facebook.email = (profile.emails[0].value || '').toLowerCase();
                var moment = require('moment');
                user.facebook.created_at = moment().format();

                user.save(function(err) {
                  if (err){
                        console.log(err);
                        return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                  }

                    return done(null, user);
                });

            }
        });

    }));

    // =========================================================================
    // TWITTER =================================================================
    // =========================================================================
    passport.use(new TwitterStrategy({

        consumerKey     : configAuth.twitterAuth.consumerKey,
        consumerSecret  : configAuth.twitterAuth.consumerSecret,
        callbackURL     : configAuth.twitterAuth.callbackURL,
        passReqToCallback : true // allows us to pass in the req from our route (lets us check if a user is logged in or not)

    },
    function(req, token, tokenSecret, profile, done) {

        // asynchronous
        process.nextTick(function() {

            // check if the user is already logged in
            if (!req.user) {

                User.findOne({ 'twitter.id' : profile.id }, function(err, user) {
                  if (err){
                        console.log(err);
                        return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                  }

                    if (user) {
                        // if there is a user id already but no token (user was linked at one point and then removed)
                        if (!user.twitter.token) {
                            user.twitter.token       = token;
                            user.twitter.username    = profile.username;
                            user.twitter.displayName = profile.displayName;

                            user.save(function(err) {
                              if (err){
                                    console.log(err);
                                    return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                              }

                                return done(null, user);
                            });
                        }
                        var moment = require('moment');
                        user.lastConnectionDate = moment().format();
                        user.save(function(err, user) {
                          if (err){
                                console.log(err);
                                return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                          }
                            return done(null, user); // user found, return that user
              					});
                    } else {
                        // if there is no user, create them
                        var newUser                 = new User();
                        //console.log(profile);
                        newUser.twitter.id          = profile.id;
                        newUser.twitter.token       = token;
                        newUser.twitter.username    = profile.username;
                        newUser.twitter.displayName = profile.displayName;
                        var moment = require('moment');
                        newUser.twitter.created_at  = moment().format();
                        newUser.plan.customer_id = "cus_007";
                        newUser.plan.plan_id = "Free";
                        newUser.plan.timeout = 1800000;

                        newUser.save(function(err) {
                          if (err){
                                console.log(err);
                                return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                          }

                            return done(null, newUser);
                        });
                    }
                });

            } else {
                // user already exists and is logged in, we have to link accounts
                var user                 = req.user; // pull the user out of the session

                user.twitter.id          = profile.id;
                user.twitter.token       = token;
                user.twitter.username    = profile.username;
                user.twitter.displayName = profile.displayName;
                var moment = require('moment');
                user.twitter.created_at  = moment().format();

                user.save(function(err) {
                  if (err){
                        console.log(err);
                        return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                  }

                    return done(null, user);
                });
            }

        });

    }));

    // =========================================================================
    // GOOGLE ==================================================================
    // =========================================================================
    passport.use(new GoogleStrategy({

        clientID        : configAuth.googleAuth.clientID,
        clientSecret    : configAuth.googleAuth.clientSecret,
        callbackURL     : configAuth.googleAuth.callbackURL,
        passReqToCallback : true // allows us to pass in the req from our route (lets us check if a user is logged in or not)

    },
    function(req, token, refreshToken, profile, done) {

        // asynchronous
        process.nextTick(function() {

            // check if the user is already logged in
            if (!req.user) {

                User.findOne({ 'google.id' : profile.id }, function(err, user) {
                  if (err){
                        console.log(err);
                        return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                  }

                    if (user) {

                        // if there is a user id already but no token (user was linked at one point and then removed)
                        if (!user.google.token) {
                            user.google.token = token;
                            user.google.name  = profile.displayName;
                            user.google.email = (profile.emails[0].value || '').toLowerCase(); // pull the first email

                            user.save(function(err) {
                              if (err){
                                    console.log(err);
                                    return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                              }

                                return done(null, user);
                            });
                        }
                        var moment = require('moment');
                        user.lastConnectionDate = moment().format();
                        user.save(function(err, user) {
                          if (err){
                                console.log(err);
                                return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                          }
                            return done(null, user); // user found, return that user
              					});
                    } else {
                        var newUser          = new User();

                        newUser.google.id    = profile.id;
                        newUser.google.token = token;
                        newUser.google.name  = profile.displayName;
                        newUser.google.email = (profile.emails[0].value || '').toLowerCase(); // pull the first email
                        var moment = require('moment');
                        newUser.google.created_at = moment().format();
                        newUser.plan.customer_id = "cus_007";
                        newUser.plan.plan_id = "Free";
                        newUser.plan.timeout = 1800000;

                        newUser.save(function(err) {
                          if (err){
                                console.log(err);
                                return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                          }

                            return done(null, newUser);
                        });
                    }
                });

            } else {
                // user already exists and is logged in, we have to link accounts
                var user               = req.user; // pull the user out of the session

                user.google.id    = profile.id;
                user.google.token = token;
                user.google.name  = profile.displayName;
                user.google.email = (profile.emails[0].value || '').toLowerCase(); // pull the first email
                var moment = require('moment');
                user.google.created_at = moment().format();

                user.save(function(err) {
                  if (err){
                        console.log(err);
                        return done(null, false, req.flash('signupMessage', 'Oops error! Please contact us if needed!'));
                  }

                    return done(null, user);
                });

            }

        });

    }));

};
