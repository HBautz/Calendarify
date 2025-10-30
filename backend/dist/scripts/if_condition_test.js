"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const prisma_service_1 = require("../src/prisma.service");
const workflows_service_1 = require("../src/workflows/workflows.service");
const notifications_service_1 = require("../src/notifications/notifications.service");
const workflow_execution_service_1 = require("../src/workflows/workflow-execution.service");
async function main() {
    const prisma = new prisma_service_1.PrismaService();
    const workflowsService = new workflows_service_1.WorkflowsService(prisma);
    const notifications = new notifications_service_1.NotificationsService();
    const exec = new workflow_execution_service_1.WorkflowExecutionService(prisma, workflowsService, notifications);
    const userId = 'test-user';
    const booking = { email: 'heine@example.com', title: 'Strategy Call', eventType: 'Strategy Call' };
    const contact = { email: 'contact@example.com', name: 'Jon Doe', tags: ['VIP', 'Newsletter'] };
    const cases = [];
    const emails = [];
    for (let i = 0; i < 40; i++) {
        if (i % 2 === 0)
            emails.push(`heine${i}@example.com`);
        else if (i % 5 === 0)
            emails.push(`USER${i}@HEINE.org`);
        else if (i % 3 === 0)
            emails.push(`user.${i}@sample.org`);
        else
            emails.push(`contact${i}@company.dev`);
    }
    emails.forEach((em, i) => {
        const has = em.includes('heine');
        cases.push({ name: `booking.email contains heine #${i + 1}`, field: 'booking.email', operator: 'contains', value: 'heine', context: { userId, booking: { ...booking, email: em } }, expect: has });
        cases.push({ name: `contact.email contains heine via fallback #${i + 1}`, field: 'contact.email', operator: 'contains', value: 'heine', context: { userId, booking: { ...booking, email: em } }, expect: has });
        cases.push({ name: `contact.email not_contains heine #${i + 1}`, field: 'contact.email', operator: 'not_contains', value: 'heine', context: { userId, contact: { ...contact, email: em } }, expect: !has });
    });
    const presentCtx = { userId, booking: { ...booking, location: 'Zoom', note: '' }, contact: { ...contact, phone: '' } };
    cases.push({ name: 'exists booking.email', field: 'booking.email', operator: 'exists', context: { userId, booking }, expect: true });
    cases.push({ name: 'not_exists booking.undefinedField', field: 'booking.undefinedField', operator: 'not_exists', context: { userId, booking }, expect: true });
    cases.push({ name: 'exists contact.phone (empty string counts missing)', field: 'contact.phone', operator: 'exists', context: presentCtx, expect: false });
    cases.push({ name: 'not_exists contact.phone (empty string counts missing)', field: 'contact.phone', operator: 'not_exists', context: presentCtx, expect: true });
    const durations = Array.from({ length: 20 }, (_, idx) => idx * 10);
    durations.forEach((d, i) => {
        cases.push({ name: `equals numeric number==string #${i + 1}`, field: 'booking.duration', operator: 'equals', value: String(d), context: { userId, booking: { ...booking, duration: d } }, expect: true });
        cases.push({ name: `not_equals numeric number!=string #${i + 1}`, field: 'booking.duration', operator: 'not_equals', value: String(d + 1), context: { userId, booking: { ...booking, duration: d } }, expect: true });
    });
    durations.forEach((d, i) => {
        cases.push({ name: `gt true #${i + 1}`, field: 'booking.duration', operator: 'gt', value: d - 1, context: { userId, booking: { ...booking, duration: d } }, expect: true });
        cases.push({ name: `gt false #${i + 1}`, field: 'booking.duration', operator: 'gt', value: d + 1, context: { userId, booking: { ...booking, duration: d } }, expect: false });
        cases.push({ name: `lt true #${i + 1}`, field: 'booking.duration', operator: 'lt', value: d + 1, context: { userId, booking: { ...booking, duration: d } }, expect: true });
        cases.push({ name: `lt false #${i + 1}`, field: 'booking.duration', operator: 'lt', value: d - 1, context: { userId, booking: { ...booking, duration: d } }, expect: false });
    });
    const locations = ['Zoom', 'Meet', 'Phone', 'Custom'];
    locations.forEach((loc, i) => {
        cases.push({ name: `in array includes #${i + 1}`, field: 'booking.location', operator: 'in', value: locations, context: { userId, booking: { ...booking, location: loc } }, expect: true });
        cases.push({ name: `in array excludes #${i + 1}`, field: 'booking.location', operator: 'in', value: ['Email', 'Onsite'], context: { userId, booking: { ...booking, location: loc } }, expect: false });
        cases.push({ name: `in scalar equal #${i + 1}`, field: 'booking.location', operator: 'in', value: loc, context: { userId, booking: { ...booking, location: loc } }, expect: true });
    });
    const tagTests = ['VIP', 'Newsletter', 'Prospect', 'Candidate'];
    tagTests.forEach((t, i) => {
        cases.push({ name: `equals array membership present #${i + 1}`, field: 'contact.tags', operator: 'equals', value: t, context: { userId, contact }, expect: contact.tags.includes(t) });
        cases.push({ name: `not_equals array membership absent #${i + 1}`, field: 'contact.tags', operator: 'not_equals', value: t, context: { userId, contact }, expect: !contact.tags.includes(t) });
    });
    const errCtx = { userId, booking: { ...booking, duration: 'NaN' } };
    for (let i = 0; i < 60; i++) {
        cases.push({ name: `error gt non-numeric default false #${i + 1}`, field: 'booking.duration', operator: 'gt', value: 10, context: errCtx, expect: false });
    }
    for (let i = 0; i < 40; i++) {
        cases.push({ name: `error unsupported operator default false #${i + 1}`, field: 'booking.email', operator: 'unsupported_op', value: 'x', context: { userId, booking }, expect: false });
    }
    const rows = [];
    rows.push(['name', 'field', 'operator', 'value', 'actual', 'result', 'expected', 'pass'].join(','));
    for (const tc of cases) {
        const props = { field: tc.field, operator: tc.operator, value: tc.value };
        if (tc.name.includes('error'))
            props.missingDataBehavior = 'default_false_path_on_error';
        const { result, detail, actual } = await exec.evaluateIfForTest(props, tc.context);
        const pass = result === tc.expect;
        rows.push([
            escapeCsv(tc.name),
            escapeCsv(tc.field),
            escapeCsv(tc.operator),
            escapeCsv(tc.value === undefined ? '' : JSON.stringify(tc.value)),
            escapeCsv(actual === undefined ? '' : JSON.stringify(actual)),
            String(result),
            String(tc.expect),
            String(pass)
        ].join(','));
    }
    const outPath = (0, path_1.join)(__dirname, '..', 'if_test.csv');
    (0, fs_1.writeFileSync)(outPath, rows.join('\n'), 'utf8');
    console.log(`Wrote ${cases.length} rows to ${outPath}`);
    process.exit(0);
}
function escapeCsv(s) {
    const str = String(s);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=if_condition_test.js.map