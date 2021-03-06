/* eslint no-unused-vars: 1 */
const VError = require('verror');
const debug = require('debug')('icarus-error');

function pageNotFound(req, res, next) {
  debug(`Page not found: ${req.path}`);
  return res.status(404).render('message', {
    title: 'Page Not Found',
    message: 'Can not find that page',
  });
}

function serverError(err, req, res, next) {
  debug('Internal Server Error Occured');
  const error = new VError(err, 'Unhandled Server Error');
  console.error(error);
  return res.status(500).render('message', {
    title: 'Server Error',
    message: 'Looks like something broke.',
    error: process.env.NODE_ENV === 'production' ? null : error,
  });
}

module.exports.PAGE_NOT_FOUND = pageNotFound;
module.exports.SERVER_ERROR = serverError;
