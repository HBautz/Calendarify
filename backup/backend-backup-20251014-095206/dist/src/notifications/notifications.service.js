"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = require("nodemailer");
const ics_1 = require("ics");
let NotificationsService = class NotificationsService {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.NOTIF_GMAIL,
            pass: process.env.NOTIF_GMAIL_PASSWORD,
        },
    });
    async sendMail(options) {
        let attachments = [];
        if (options.event) {
            const { error, value } = (0, ics_1.createEvent)(options.event);
            if (!error && value !== undefined) {
                attachments.push({
                    filename: 'invite.ics',
                    content: value,
                    contentType: 'text/calendar',
                });
            }
        }
        await this.transporter.sendMail({
            from: process.env.NOTIF_GMAIL,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
            bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
            subject: options.subject,
            text: options.text,
            html: options.html,
            attachments,
        });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)()
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map