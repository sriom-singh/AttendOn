import nodemailer from 'nodemailer';


export const sendMail = async (to, subject, html) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.PASSWORD
            }
        });

        const mailOptions = {
            from: '"AttendOn" <no-reply@attendon.com>',
            to,
            subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);

        console.log("Email sent:", info.response);
        return true; 

    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};