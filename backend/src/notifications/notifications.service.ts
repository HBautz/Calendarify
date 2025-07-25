import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { createEvent, EventAttributes } from 'ics';

@Injectable()
export class NotificationsService {
  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.NOTIF_GMAIL,
      pass: process.env.NOTIF_GMAIL_PASSWORD,
    },
  });

  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    event?: EventAttributes;
  }): Promise<void> {
    let attachments = [] as { filename: string; content: string; contentType: string }[];
    if (options.event) {
      const { error, value } = createEvent(options.event);
      if (!error) {
        attachments.push({
          filename: 'invite.ics',
          content: value,
          contentType: 'text/calendar',
        });
      }
    }
    await this.transporter.sendMail({
      from: process.env.NOTIF_GMAIL,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments,
    });
  }
}
