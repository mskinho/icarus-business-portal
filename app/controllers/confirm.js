const nodemailer = require('nodemailer');
const VError = require('verror');
const debug = require('debug')('icarus-confirm');
const models = require('../models');

const Confirm = models.CONFIRM;
const User = models.USER;

const smtpCreds = {
  service: process.env.EMAIL_SERVICE,
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
};

const transporter = nodemailer.createTransport(smtpCreds);

function renderResend(req, res) {
  return res.render('resend');
}

function renderConfirmation(req, res) {
  return res.render('confirm');
}

function resendConfirmation(req, res) {
  if (req.body.email) {
    confirmUser(req.body.email);
  }
  return res.redirect('/login');
}

function confirmToken(req, res, next) {
  if (req.params.token) {
    return Confirm.findOne({ token: req.params.token }, (err, confirm) => {
      const { email } = confirm;
      if (err) return next(new VError(err, 'Problem finding token'));
      if (confirm) {
        return User.findOneAndUpdate(
          { email },
          { isVerified: true },
          { upsert: true, new: true },
          (err, user) => {
            if (err)
              return next(new VError(err, 'Problem verifiying user record'));
            debug(`New User Verified: ${user.email}`);
            return res.redirect('/');
          },
        );
      } else {
        return next(new VError(err, 'No confirmation found'));
      }
    });
  }
  return res.redirect('/login');
}

function confirmUser(email) {
  return Confirm.findOne({ email }, (err, confirm) => {
    if (err) throw new VError(err, 'Problem finding confirmation record');
    debug(`Confirmation token sent: ${email}`);
    if (confirm) {
      return sendToken(confirm);
    } else {
      return Confirm.create({ email }, (err, confirm) => {
        if (err) throw err;
        sendToken(confirm);
      });
    }
  });
}

function sendToken(object) {
  const { email, token } = object;
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Confirm you Email Address',
    text: `Howdy!\n\nPlease confirm your address by clicking this link: ${
      process.env.HOST
    }/confirm/token/${token}`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      return debug(err);
    }
    return debug(`Confirmation token sent: ${info.messageId}`);
  });
}

module.exports.RENDER_RESEND = renderResend;
module.exports.RENDER_CONFIRM = renderConfirmation;
module.exports.RESEND_CONFIRM = resendConfirmation;
module.exports.CONFIRM_TOKEN = confirmToken;
module.exports.CONFIRM_USER = confirmUser;