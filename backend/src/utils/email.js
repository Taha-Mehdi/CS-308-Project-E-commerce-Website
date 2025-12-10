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

async function sendInvoiceEmail(toEmail, pdfBuffer, orderId) {
  // Still route ALL emails to TA inbox (demo requirement)
  const targetEmail = 'csjira308@outlook.com';

  const safeCustomerEmail = toEmail || 'unknown@example.com';

  const mailOptions = {
    from: '"Sneaks-Up Store (Demo)" <csjira308@outlook.com>',

    // TA inbox
    to: targetEmail,

    // So TA can click "Reply" and respond to the customer directly
    replyTo: safeCustomerEmail,

    subject: `Order invoice #${orderId} – Sneaks-Up`,

    text:
      `Dear Customer,\n\n` +
      `Thank you for shopping with Sneaks-Up.\n\n` +
      `Attached is the PDF invoice for your order #${orderId}.\n\n` +
      `For this CS308 demo, all order-related emails are routed to ` +
      `csjira308@outlook.com.\n\n` +
      `Customer email: ${safeCustomerEmail}\n\n` +
      `Best regards,\n` +
      `Sneaks-Up Team`,

    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
        <p>Dear Customer,</p>

        <p>
          Thank you for shopping with <strong>Sneaks-Up</strong>.
        </p>

        <p>
          Attached you can find the PDF invoice for your order
          <strong>#${orderId}</strong>.
        </p>

        <p style="font-size: 13px; color: #555;">
          <em>Note:</em> This is a CS308 demo environment.
          All order-related emails are being sent to
          <code>csjira308@outlook.com</code>.
        </p>

        <p style="font-size: 13px; color: #555;">
          <strong>Customer email:</strong> ${safeCustomerEmail}
        </p>

        <p>
          Best regards,<br/>
          <strong>Sneaks-Up Team</strong>
        </p>
      </div>
    `,

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
