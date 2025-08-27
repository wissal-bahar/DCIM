import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT || 465);
const user = process.env.SMTP_USER!;
const pass = process.env.SMTP_PASS!;
const from = process.env.APP_FROM || "DCIM Project <no-reply@dcimProject.local>";

export const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true pour 465 (SSL), false pour 587 (TLS)
    auth: { user, pass },
});

export async function sendOtpMail(to: string, code: string) {
    const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial; color:#0b122b">
      <h2 style="margin:0 0 8px">Votre code de connexion</h2>
      <p>Voici votre code à 6 chiffres, valable <b>10 minutes</b> :</p>
      <p style="font-size:24px;font-weight:800;letter-spacing:.12em">${code}</p>
      <p style="color:#6b7bb7;font-size:13px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    </div>
  `;

    return transporter.sendMail({
        from,
        to,
        subject: "DCIM — Code de connexion",
        text: `Code de connexion: ${code} (valable 10 minutes)`,
        html,
    });
}
