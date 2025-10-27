import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import { emailTemplate } from './send.temp';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async sendEmail(mailOptions: Mail.Options) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const info = await this.transporter.sendMail({
      from: `NestJS <${process.env.EMAIL_USER}>`,
      ...mailOptions,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.log('Message sent:', info.messageId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return info;
  }

  generateOtp(): number {
    return Math.floor(100000 + Math.random() * 900000);
  }
  async sendOtpEmail(to: string, otp: string) {
    const html = emailTemplate(otp, 'Confirm Your Email');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.sendEmail({
      to,
      subject: 'Your Verification Code',
      html,
    });
  }
}
