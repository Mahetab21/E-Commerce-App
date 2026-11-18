import nodemailer from 'nodemailer';

describe('Mail transport compatibility', () => {
  it('composes an OTP message with the installed transport without sending mail', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    const info = await transport.sendMail({
      from: 'E-Commerce <noreply@example.test>',
      to: 'customer@example.test',
      subject: 'Confirm email',
      text: 'Your code is 123456. It expires in 10 minutes.',
    });
    expect(info.envelope.to).toEqual(['customer@example.test']);
    expect(info.message.toString()).toContain('Your code is 123456.');
    expect(info.message.toString()).toContain('Subject: Confirm email');
  });
});
