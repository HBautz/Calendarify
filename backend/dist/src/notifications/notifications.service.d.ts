import { EventAttributes } from 'ics';
export declare class NotificationsService {
    private transporter;
    sendMail(options: {
        to: string | string[];
        cc?: string | string[];
        bcc?: string | string[];
        subject: string;
        text?: string;
        html?: string;
        event?: EventAttributes;
    }): Promise<void>;
}
