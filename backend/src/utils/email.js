const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/*
  Sends invoice email with PDF buffer attached.
*/
async function sendInvoiceEmail(toEmail, pdfBuffer, orderId) {
    const mailOptions = {
        from: process.env.SMTP_USER,
        to: toEmail,
        subject: `Your order invoice #${orderId}`,
        text: `Thank you for your order! Attached is your invoice.`,
        attachments: [
            {
                filename: `invoice_${orderId}.pdf`,
                content: pdfBuffer,
            },
        ],
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { sendInvoiceEmail };
