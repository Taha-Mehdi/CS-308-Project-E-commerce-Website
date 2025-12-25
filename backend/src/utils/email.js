const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: "SSLv3",
    rejectUnauthorized: false,
  },
});

async function sendInvoiceEmail(toEmail, pdfBuffer, orderId) {
  // Still route ALL emails to TA inbox 
  const targetEmail = "csjira9@gmail.com";

  const safeCustomerEmail = toEmail || "unknown@example.com";

  const mailOptions = {
    from: '"Sneaks-Up Store (Demo)" <csjira9@gmail.com>',

    to: safeCustomerEmail,

    replyTo: ["csjira9@gmail.com", safeCustomerEmail],

    subject: `Order invoice #${orderId} – Sneaks-Up`,

    text:
      `Dear Customer,\n\n` +
      `Thank you for shopping with Sneaks-Up.\n\n` +
      `Attached is the PDF invoice for your order #${orderId}.\n\n` +
      `For this CS308 demo, all order-related emails are routed to ` +
      `csjira9@gmail.com.\n\n` +
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
          <code>csjira9@gmail.com</code>.
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

// Wishlist discount notification
async function sendDiscountEmail(toEmail, discountedProducts, discountRate) {
  const safeCustomerEmail = toEmail || "unknown@example.com";

  const rowsText = discountedProducts
    .map(
      (p) =>
        `- ${p.name} (Product #${p.id}): new price $${Number(p.price).toFixed(2)}`
    )
    .join("\n");

  const rowsHtml = discountedProducts
    .map(
      (p) => `
        <li>
          <strong>${p.name}</strong> (Product #${p.id}) —
          new price <strong>$${Number(p.price).toFixed(2)}</strong>
        </li>
      `
    )
    .join("");

  const mailOptions = {
    from: '"Sneaks-Up Store (Demo)" <csjira9@gmail.com>',
    to: safeCustomerEmail,
    replyTo: ["csjira9@gmail.com", safeCustomerEmail],
    subject: `Wishlist discount alert – ${Number(discountRate).toFixed(2)}% off`,
    text:
      `Hello,\n\n` +
      `One or more products in your wishlist are now discounted (${Number(discountRate).toFixed(
        2
      )}% off):\n\n` +
      `${rowsText}\n\n` +
      `Sneaks-Up Team`,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
        <p>Hello,</p>
        <p>
          One or more products in your wishlist are now discounted
          (<strong>${Number(discountRate).toFixed(2)}% off</strong>):
        </p>
        <ul>
          ${rowsHtml}
        </ul>
        <p>— Sneaks-Up Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendInvoiceEmail, sendDiscountEmail };
