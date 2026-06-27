const nodemailer = require('nodemailer');
const config = require('../config');

const transport = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: false,
  ignoreTLS: true,
});

async function sendMagicLink(email, url) {
  // En dev siempre logueamos el enlace para no depender de MailHog.
  if (config.env !== 'production') {
    console.log(`[magic-link] ${email} -> ${url}`);
  }
  try {
    await transport.sendMail({
      from: config.mail.from,
      to: email,
      subject: 'Tu enlace de acceso al Registro Municipal',
      text: `Accede al registro con este enlace (caduca en ${config.magicLinkTtlMin} min):\n\n${url}\n`,
      html: `<p>Accede al registro con este enlace (caduca en ${config.magicLinkTtlMin} min):</p>`
        + `<p><a href="${url}">${url}</a></p>`,
    });
  } catch (err) {
    if (config.env === 'production') throw err;
    console.warn(`[magic-link] no se pudo enviar el email (${err.message}); usa el enlace de la consola.`);
  }
}

module.exports = { sendMagicLink };
