const path = require('path');
const dotenv = require('dotenv');

const env = dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const morganDebug = require('morgan-debug');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const helmet = require('helmet');
const passport = require('passport');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const moment = require('moment');
const phoneNumber = require('libphonenumber-js');
const numeral = require('numeral');
const VError = require('verror');

const debug = require('debug')('icarus-init');
const envDebug = require('debug')('icarus-env');
const routeDebug = require('debug')('icarus-routes');
const dbDebug = require('debug')('icarus-database');

const { Strategies, Plans } = require('./config');
const { Auth } = require('./helpers');
const routes = require('./app/routes');

/**
 * Check for envirnment variables
 */
if (env.error) {
  throw new VError(env.error, 'Problem loading environment variables...');
} else {
  Object.entries(env.parsed).forEach(rule => {
    envDebug(`${rule[0]} = ${rule[1]}`);
  });
}

/**
 * Variables and Constants
 */

const app = express();
const { NODE_ENV } = process.env;
const port =
  NODE_ENV === 'production' ? process.env.PORT : process.env.TEST_PORT;
const db = NODE_ENV === 'production' ? process.env.DB : process.env.TEST_DB;

/**
 * Database Connection Handlers
 */

mongoose.connection.on('error', err => {
  if (err) throw new VError(err, 'Problem connecting to database.');
});

mongoose.connection.on('disconnected', () => {
  dbDebug('Disconnected from database.');
});

mongoose.connection.on('connected', () => {
  dbDebug('Successfully connected to database.');

  const sessionSettings = {
    resave: false,
    secret: process.env.SESSION_SECRET || 'superdupersekrit',
    saveUninitialized: false,
    store: new RedisStore({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    }),
  };

  /**
   * Express/Passport Configuration
   */

  app.set('view engine', 'pug');
  app.set('views', path.join(__dirname, 'client/views'));

  app.use('/assets', express.static('build'));
  app.use('/assets/img', express.static('client/img'));
  app.use('/.well-known', express.static('.well-known', { dotfiles: 'allow' }));
  app.use(
    morganDebug(
      'icarus-morgan',
      NODE_ENV === 'development' ? 'dev' : 'combined',
    ),
  );
  app.use(bodyParser.urlencoded({ extended: 'true' }));
  app.use(bodyParser.json());
  app.use(methodOverride());
  app.use(helmet());
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  app.locals.moment = moment;
  app.locals.phoneNumber = phoneNumber;
  app.locals.numeral = numeral;
  app.locals.plans = Plans;

  passport.use(Strategies.LOCAL);
  passport.serializeUser(Auth.SERIALIZE_USER);
  passport.deserializeUser(Auth.DESERIALIZE_USER);

  /**
   * Load express routes
   */

  Object.entries(routes)
    .sort(a => {
      if (a[0] === 'Error') {
        // Error routes must be loaded last.
        return 1;
      }
      return 0;
    })
    .forEach(route => {
      routeDebug(`${route[0]} routes - Loaded`);
      app.use(route[1]);
    });

  /**
   * Launch Server
   */

  app.listen(port, err => {
    if (err) throw new VError(err, 'Problem launching express server');
    debug(`Icarus is flying UP & UP... => http://localhost:${port}`);
  });
});

/**
 * Connect to database
 */

dbDebug(`Connecting to database: ${db}`);
mongoose.connect(db);

/**
 * Termination and Exit handling
 */

process.on('SIGINT', gracefulExit);
process.on('SIGTERM', gracefulExit);
process.on('uncaughtException', err => {
  console.error(err.stack);
  debug('Icarus flew too high to the sun and CRASHED to the waves below...');
  gracefulExit();
});

function gracefulExit() {
  debug(`Icarus is going DOWN...`);
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}
