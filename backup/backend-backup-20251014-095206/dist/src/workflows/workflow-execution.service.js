"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WorkflowExecutionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowExecutionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const workflows_service_1 = require("./workflows.service");
const notifications_service_1 = require("../notifications/notifications.service");
let WorkflowExecutionService = class WorkflowExecutionService {
    static { WorkflowExecutionService_1 = this; }
    prisma;
    workflowsService;
    notifications;
    logger = new common_1.Logger(WorkflowExecutionService_1.name);
    static errorLog = [];
    static MAX_ERRORS = 200;
    static runLog = [];
    constructor(prisma, workflowsService, notifications) {
        this.prisma = prisma;
        this.workflowsService = workflowsService;
        this.notifications = notifications;
    }
    async onMeetingScheduled(userId, eventTypeTitle, bookingId, eventTypeId) {
        this.logger.log(`🔔 Meeting scheduled for user ${userId}, event type: ${eventTypeTitle}`);
        try {
            const workflows = await this.workflowsService.list(userId);
            const meetingScheduledWorkflows = workflows.filter(workflow => {
                const workflowData = workflow.data || workflow;
                return workflow.status === true && workflowData.trigger === 'Meeting Scheduled';
            });
            this.logger.log(`📋 Found ${meetingScheduledWorkflows.length} Meeting Scheduled workflows`);
            for (const workflow of meetingScheduledWorkflows) {
                const workflowData = workflow.data || workflow;
                const triggerEventTypes = Array.isArray(workflowData.triggerEventTypes) ? workflowData.triggerEventTypes : [];
                const triggerEventTypeIds = Array.isArray(workflowData.triggerEventTypeIds) ? workflowData.triggerEventTypeIds : [];
                const titleMatch = triggerEventTypes.map(t => String(t).toLowerCase().trim()).includes(String(eventTypeTitle).toLowerCase().trim());
                const idMatch = eventTypeId ? triggerEventTypeIds.includes(String(eventTypeId)) : false;
                const match = (triggerEventTypes.length === 0 && triggerEventTypeIds.length === 0) || titleMatch || idMatch;
                this.logger.log(`🔍 Workflow "${workflow.name}": triggerTitles=${JSON.stringify(triggerEventTypes)} triggerIds=${JSON.stringify(triggerEventTypeIds)}; incoming title="${eventTypeTitle}" id=${eventTypeId}; match=${match}`);
                if (match) {
                    this.logger.log(`⚡ Executing workflow: ${workflow.name} for event type: ${eventTypeTitle}`);
                    const context = {
                        userId,
                        eventType: eventTypeTitle,
                        bookingId,
                    };
                    await this.executeWorkflow(workflow, context);
                }
                else {
                    this.logger.log(`❌ Skipping workflow: ${workflow.name} — event type mismatch`);
                }
            }
        }
        catch (error) {
            this.logger.error(`❌ Error executing Meeting Scheduled workflows: ${error.message}`, error.stack);
        }
    }
    async onTagAdded(userId, tagName, contactId) {
        this.logger.log(`🏷️ Tag "${tagName}" added to contact ${contactId} for user ${userId}`);
        try {
            const workflows = await this.workflowsService.list(userId);
            this.logger.log(`📋 Total workflows found for user: ${workflows.length}`);
            workflows.forEach((workflow, index) => {
                const workflowData = workflow.data || workflow;
                this.logger.log(`📝 Workflow ${index + 1}: "${workflow.name}" - Status: ${workflow.status}, Trigger: ${workflowData.trigger}, TriggerTags: ${JSON.stringify(workflowData.triggerTags || [])}`);
            });
            const tagAddedWorkflows = workflows.filter(workflow => {
                const workflowData = workflow.data || workflow;
                const shouldTrigger = workflow.status === true && workflowData.trigger === 'Tag Added';
                this.logger.log(`🔍 Workflow "${workflow.name}": status=${workflow.status}, trigger=${workflowData.trigger}, shouldTrigger=${shouldTrigger}`);
                return shouldTrigger;
            });
            this.logger.log(`📋 Found ${tagAddedWorkflows.length} Tag Added workflows`);
            for (const workflow of tagAddedWorkflows) {
                const workflowData = workflow.data || workflow;
                const triggerTags = workflowData.triggerTags || [];
                this.logger.log(`🔍 Checking if workflow "${workflow.name}" should trigger for tag "${tagName}"`);
                this.logger.log(`   Trigger tags: ${JSON.stringify(triggerTags)}`);
                this.logger.log(`   Tag to match: ${tagName}`);
                if (triggerTags.length === 0 || triggerTags.includes(tagName)) {
                    this.logger.log(`✅ Workflow "${workflow.name}" should trigger for tag "${tagName}"`);
                    this.logger.log(`⚡ Executing workflow: ${workflow.name} for tag: ${tagName}`);
                    const context = {
                        userId,
                        tagName,
                        contactId,
                    };
                    await this.executeWorkflow(workflow, context);
                }
                else {
                    this.logger.log(`❌ Workflow "${workflow.name}" should NOT trigger for tag "${tagName}"`);
                    this.logger.log(`   Required tags: ${JSON.stringify(triggerTags)}`);
                    this.logger.log(`   Provided tag: ${tagName}`);
                }
            }
        }
        catch (error) {
            this.logger.error(`❌ Error executing Tag Added workflows: ${error.message}`, error.stack);
        }
    }
    async executeWorkflow(workflow, context) {
        const workflowData = workflow.data || workflow;
        const steps = workflowData.steps || [];
        this.logger.log(`🚀 Executing workflow "${workflow.name}" with ${steps.length} steps`);
        try {
            await this.attachContextPayload(workflowData, context);
        }
        catch (e) {
            this.logger.warn(`⚠️ Failed to attach full context payload: ${e?.message || e}`);
        }
        let run = null;
        let ephemeralRunId = null;
        try {
            run = await this.prisma.workflowRun.create({
                data: {
                    user_id: workflow.userId,
                    workflow_id: workflow.id,
                    status: 'running',
                    trigger: workflowData.trigger || undefined,
                    context: context,
                },
            });
        }
        catch (e) {
            this.logger.warn(`⚠️ Could not persist workflow run (migration pending?): ${e?.message || e}`);
            ephemeralRunId = `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            WorkflowExecutionService_1.runLog.push({
                id: ephemeralRunId,
                user_id: workflow.userId,
                workflow_id: workflow.id,
                status: 'running',
                trigger: workflowData.trigger || null,
                context,
                started_at: new Date(),
                finished_at: null,
                steps: [],
            });
        }
        let failed = 0;
        let succeeded = 0;
        const stack = [];
        const computeSkipping = () => stack.some(b => (b.inElse ? b.conditionTrue : !b.conditionTrue));
        let skipping = false;
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const type = String(step?.type || '');
            this.logger.log(`📝 Executing step ${i + 1}/${steps.length}: ${type}`);
            let stepRun = null;
            if (run) {
                try {
                    stepRun = await this.prisma.workflowStepRun.create({
                        data: {
                            workflow_run_id: run.id,
                            index: i,
                            type: type || 'Unknown',
                            status: 'running',
                        },
                    });
                }
                catch (e) {
                    this.logger.warn(`⚠️ Could not persist step run: ${e?.message || e}`);
                }
            }
            else if (ephemeralRunId) {
                const r = WorkflowExecutionService_1.runLog.find(r => r.id === ephemeralRunId);
                if (r)
                    r.steps.push({ index: i, type: type || 'Unknown', status: 'running' });
            }
            try {
                if (type === 'If') {
                    delete context.__lastStepMessage;
                    await this.executeIf((step.props ?? step.properties ?? step.data?.properties) || {}, context);
                    const condTrue = !(context.__skipNextStep === true);
                    try {
                        const ifId = String(((step && (step.props ?? step.properties ?? step.data?.properties)) || {}).ifId || '');
                        if (ifId)
                            context[`if:${ifId}`] = !!condTrue;
                    }
                    catch { }
                    stack.push({ conditionTrue: condTrue, inElse: false });
                    skipping = computeSkipping();
                    this.logger.log(`🔀 If evaluated to ${condTrue ? 'TRUE' : 'FALSE'}`);
                    succeeded++;
                    if (stepRun) {
                        try {
                            await this.prisma.workflowStepRun.update({
                                where: { id: stepRun.id },
                                data: {
                                    status: 'success',
                                    finished_at: new Date(),
                                    message: context.__lastStepMessage ? String(context.__lastStepMessage) : `If => ${condTrue}`,
                                },
                            });
                        }
                        catch { }
                    }
                    else if (ephemeralRunId) {
                        const r = WorkflowExecutionService_1.runLog.find(r => r.id === ephemeralRunId);
                        if (r) {
                            const s = r.steps.find(s => s.index === i);
                            if (s) {
                                s.status = 'success';
                                s.message = context.__lastStepMessage ? String(context.__lastStepMessage) : `If => ${condTrue}`;
                            }
                        }
                    }
                    continue;
                }
                else if (type === 'Else') {
                    const top = stack[stack.length - 1];
                    if (top) {
                        top.inElse = true;
                        skipping = computeSkipping();
                    }
                    succeeded++;
                    if (stepRun) {
                        try {
                            await this.prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: 'success', finished_at: new Date(), message: 'Else' } });
                        }
                        catch { }
                    }
                    else if (ephemeralRunId) {
                        const r = WorkflowExecutionService_1.runLog.find(r => r.id === ephemeralRunId);
                        if (r) {
                            const s = r.steps.find(s => s.index === i);
                            if (s) {
                                s.status = 'success';
                                s.message = 'Else';
                            }
                        }
                    }
                    continue;
                }
                else if (type === 'End If') {
                    if (stack.length > 0)
                        stack.pop();
                    skipping = computeSkipping();
                    succeeded++;
                    if (stepRun) {
                        try {
                            await this.prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: 'success', finished_at: new Date(), message: 'End If' } });
                        }
                        catch { }
                    }
                    else if (ephemeralRunId) {
                        const r = WorkflowExecutionService_1.runLog.find(r => r.id === ephemeralRunId);
                        if (r) {
                            const s = r.steps.find(s => s.index === i);
                            if (s) {
                                s.status = 'success';
                                s.message = 'End If';
                            }
                        }
                    }
                    continue;
                }
                const meta = ((step && (step.props ?? step.properties ?? step.data?.properties)) || {});
                const gateIf = meta.parentIfId ? String(meta.parentIfId) : null;
                if (gateIf) {
                    const flagKey = `if:${gateIf}`;
                    const condTrue = context[flagKey];
                    const shouldRun = meta.branch === 'true' ? !!condTrue : !condTrue;
                    if (!shouldRun) {
                        this.logger.log(`⏭️ Skipping step ${i + 1} (${type}) by branch gate`);
                        succeeded++;
                        if (stepRun) {
                            try {
                                await this.prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: 'success', finished_at: new Date(), message: 'Skipped by branch condition' } });
                            }
                            catch { }
                        }
                        else if (ephemeralRunId) {
                            const r = WorkflowExecutionService_1.runLog.find(r => r.id === ephemeralRunId);
                            if (r) {
                                const s = r.steps.find(s => s.index === i);
                                if (s) {
                                    s.status = 'success';
                                    s.message = 'Skipped by branch condition';
                                }
                            }
                        }
                        continue;
                    }
                }
                else if (skipping) {
                    this.logger.log(`⏭️ Skipping step ${i + 1} (${type}) due to branch`);
                    succeeded++;
                    if (stepRun) {
                        try {
                            await this.prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: 'success', finished_at: new Date(), message: 'Skipped by branch condition' } });
                        }
                        catch { }
                    }
                    else if (ephemeralRunId) {
                        const r = WorkflowExecutionService_1.runLog.find(r => r.id === ephemeralRunId);
                        if (r) {
                            const s = r.steps.find(s => s.index === i);
                            if (s)
                                s.status = 'success';
                            if (s)
                                s.message = 'Skipped by branch condition';
                        }
                    }
                    continue;
                }
                delete context.__lastStepMessage;
                await this.executeStep(step, context);
                this.logger.log(`✅ Step ${i + 1} completed successfully`);
                succeeded++;
                if (stepRun) {
                    try {
                        await this.prisma.workflowStepRun.update({
                            where: { id: stepRun.id },
                            data: {
                                status: 'success',
                                finished_at: new Date(),
                                message: context.__lastStepMessage ? String(context.__lastStepMessage) : undefined,
                            },
                        });
                    }
                    catch { }
                }
                else if (ephemeralRunId) {
                    const r = WorkflowExecutionService_1.runLog.find(r => r.id === ephemeralRunId);
                    if (r) {
                        const s = r.steps.find(s => s.index === i);
                        if (s)
                            s.status = 'success';
                        if (s && context.__lastStepMessage)
                            s.message = String(context.__lastStepMessage);
                    }
                }
            }
            catch (error) {
                failed++;
                this.logger.error(`❌ Step ${i + 1} failed: ${error.message}`, error.stack);
                WorkflowExecutionService_1.addError({
                    ts: Date.now(),
                    userId: workflow.userId,
                    workflowId: workflow.id,
                    workflowName: workflow.name,
                    stepIndex: i,
                    stepType: type || 'Unknown',
                    message: String(error?.message || error || 'Unknown error'),
                    stack: error?.stack,
                });
                if (stepRun) {
                    try {
                        await this.prisma.workflowStepRun.update({
                            where: { id: stepRun.id },
                            data: {
                                status: 'failed',
                                finished_at: new Date(),
                                message: String(error?.message || error || 'Unknown error'),
                                error_stack: error?.stack ? String(error.stack) : undefined,
                            },
                        });
                    }
                    catch { }
                }
                else if (ephemeralRunId) {
                    const r = WorkflowExecutionService_1.runLog.find(r => r.id === ephemeralRunId);
                    if (r) {
                        const s = r.steps.find(s => s.index === i);
                        if (s) {
                            s.status = 'failed';
                            s.message = String(error?.message || error || 'Unknown error');
                            s.error_stack = error?.stack ? String(error.stack) : undefined;
                        }
                    }
                }
            }
        }
        const finalStatus = failed === 0 ? 'success' : (succeeded > 0 ? 'partial' : 'failed');
        if (run) {
            try {
                await this.prisma.workflowRun.update({
                    where: { id: run.id },
                    data: { status: finalStatus, finished_at: new Date() },
                });
            }
            catch { }
        }
        else if (ephemeralRunId) {
            const r = WorkflowExecutionService_1.runLog.find(r => r.id === ephemeralRunId);
            if (r) {
                r.status = finalStatus;
                r.finished_at = new Date();
            }
        }
        this.logger.log(`🎉 Workflow "${workflow.name}" execution completed with status ${finalStatus}`);
    }
    async executeStep(step, context) {
        const type = step?.type;
        const rawProps = (step && (step.props ?? step.properties ?? step.data?.properties)) || {};
        const props = rawProps;
        switch (type) {
            case 'True':
            case 'False':
                context.__lastStepMessage = type;
                return;
            case 'Send Email':
                await this.executeSendEmail(props, context);
                break;
            case 'Delay':
                await this.executeDelay(props);
                break;
            case 'Add Tag':
                await this.executeAddTag(props, context);
                break;
            case 'If':
                await this.executeIf(props, context);
                break;
            default:
                this.logger.warn(`⚠️ Unknown step type: ${type}`);
                break;
        }
    }
    async executeIf(props, context) {
        const field = String(props.field || '').trim();
        const operator = String(props.operator || '').trim();
        const value = props.value;
        const missingBehavior = props.missingDataBehavior;
        if (!field || !operator) {
            throw new Error('If step requires field and operator');
        }
        const actual = await this.resolveFieldValue(field, context);
        const missing = actual === undefined || actual === null || (typeof actual === 'string' && actual.length === 0);
        let result = false;
        let detail = '';
        try {
            switch (operator) {
                case 'exists':
                    result = !missing;
                    break;
                case 'not_exists':
                    result = missing;
                    break;
                case 'equals':
                    result = this.coerceEquals(actual, value);
                    break;
                case 'not_equals':
                    result = !this.coerceEquals(actual, value);
                    break;
                case 'contains':
                    result = this.coerceContains(actual, value);
                    break;
                case 'not_contains':
                    result = !this.coerceContains(actual, value);
                    break;
                case 'gt':
                    result = this.coerceCompare(actual, value, 'gt');
                    break;
                case 'lt':
                    result = this.coerceCompare(actual, value, 'lt');
                    break;
                case 'in': {
                    const arr = Array.isArray(value) ? value : (value != null ? [value] : []);
                    result = arr.map(v => String(v)).includes(String(actual));
                    break;
                }
                default:
                    throw new Error(`Unsupported operator: ${operator}`);
            }
            detail = `If ${field} ${operator}${value !== undefined && !['exists', 'not_exists'].includes(operator) ? ' ' + JSON.stringify(value) : ''} => ${JSON.stringify(actual)} => ${result}`;
        }
        catch (e) {
            if (missingBehavior === 'default_false_path_on_error') {
                result = false;
                detail = `If evaluation error, defaulted to false path: ${e?.message || e}`;
            }
            else {
                throw e;
            }
        }
        context.__lastStepMessage = detail;
        context.__skipNextStep = !result;
    }
    async evaluateIfForTest(props, context) {
        const sandboxContext = {
            userId: context.userId,
            contact: context.contact || undefined,
            booking: context.booking || undefined,
        };
        await this.executeIf(props, sandboxContext);
        const result = !(sandboxContext.__skipNextStep === true);
        const detail = String(sandboxContext.__lastStepMessage || '');
        const actual = await this.resolveFieldValue(String(props.field || ''), sandboxContext);
        return { result, detail, actual };
    }
    async attachContextPayload(workflowData, context) {
        const wantFull = !!(workflowData?.contextSpec?.attachFullContext);
        if (!wantFull)
            return;
        if (context.bookingId) {
            try {
                const booking = await this.prisma.booking.findUnique({ where: { id: context.bookingId }, include: { event_type: true } });
                if (booking) {
                    context.booking = {
                        id: booking.id,
                        title: booking.event_type?.title || undefined,
                        eventType: booking.event_type?.title || undefined,
                        name: booking.name || undefined,
                        email: booking.email || undefined,
                        startTime: booking.starts_at?.toISOString?.() || booking.starts_at,
                        endTime: booking.ends_at?.toISOString?.() || booking.ends_at,
                    };
                }
            }
            catch { }
        }
        if (context.contactId) {
            try {
                const contact = await this.prisma.contact.findUnique({ where: { id: context.contactId } });
                if (contact) {
                    context.contact = {
                        id: contact.id,
                        name: contact.name || undefined,
                        email: contact.email || undefined,
                        phone: contact.phone || undefined,
                        company: contact.company || undefined,
                        createdAt: contact.created_at,
                        updatedAt: contact.updated_at,
                    };
                }
            }
            catch { }
        }
        else if (!context.contactId && context.booking && context.booking.email) {
            try {
                const existing = await this.prisma.contact.findFirst({ where: { user_id: context.userId, email: context.booking.email } });
                if (existing) {
                    context.contactId = existing.id;
                    context.contact = {
                        id: existing.id,
                        name: existing.name || undefined,
                        email: existing.email || undefined,
                        phone: existing.phone || undefined,
                        company: existing.company || undefined,
                        createdAt: existing.created_at,
                        updatedAt: existing.updated_at,
                    };
                }
            }
            catch { }
        }
    }
    async resolveFieldValue(path, context) {
        const parts = path.split('.');
        const root = parts.shift();
        const tail = parts.join('.');
        const getByPath = (obj, p) => {
            if (!obj)
                return undefined;
            if (!p)
                return obj;
            return p.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
        };
        if (root === 'contact') {
            if (!context.contact && context.contactId) {
                try {
                    const contact = await this.prisma.contact.findUnique({ where: { id: context.contactId } });
                    if (contact)
                        context.contact = contact;
                }
                catch { }
            }
            const val = getByPath(context.contact, tail);
            if ((val == null || val === undefined) && tail === 'email' && context.booking && context.booking.email) {
                return context.booking.email;
            }
            return val;
        }
        if (root === 'booking') {
            if (!context.booking && context.bookingId) {
                try {
                    const booking = await this.prisma.booking.findUnique({ where: { id: context.bookingId }, include: { event_type: true } });
                    if (booking)
                        context.booking = { ...booking, eventType: booking.event_type?.title };
                }
                catch { }
            }
            return getByPath(context.booking, tail);
        }
        return getByPath(context, [root, tail].filter(Boolean).join('.'));
    }
    coerceEquals(a, b) {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb))
            return na === nb;
        if (Array.isArray(a) && !Array.isArray(b))
            return a.map(x => String(x)).includes(String(b));
        if (!Array.isArray(a) && Array.isArray(b))
            return b.map(x => String(x)).includes(String(a));
        return String(a) === String(b);
    }
    coerceContains(a, b) {
        if (Array.isArray(a))
            return a.map(x => String(x)).includes(String(b));
        if (a == null)
            return false;
        return String(a).includes(String(b));
    }
    coerceCompare(a, b, op) {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isFinite(na) || !Number.isFinite(nb))
            throw new Error('Non-numeric comparison');
        return op === 'gt' ? na > nb : na < nb;
    }
    async executeSendEmail(props, context) {
        const useTriggerRecipient = props.useTriggerRecipient === true || (!props.to || (Array.isArray(props.to) && props.to.length === 0));
        let to = [];
        if (useTriggerRecipient) {
            if (context.contactId) {
                const contact = await this.prisma.contact.findUnique({ where: { id: context.contactId } });
                if (contact?.email)
                    to = [contact.email];
            }
            else if (context.bookingId) {
                const booking = await this.prisma.booking.findUnique({ where: { id: context.bookingId } });
                if (booking?.email)
                    to = [booking.email];
            }
            if (to.length === 0) {
                throw new Error('No recipient found for Send Email step');
            }
        }
        else {
            to = Array.isArray(props.to) ? props.to : (props.to ? [props.to] : []);
            if (to.length === 0) {
                throw new Error('Send Email step requires at least one recipient');
            }
        }
        const cc = Array.isArray(props.cc) ? props.cc : (props.cc ? [props.cc] : []);
        const bcc = Array.isArray(props.bcc) ? props.bcc : (props.bcc ? [props.bcc] : []);
        const subject = String(props.subject || '').trim();
        const body = String(props.body || '');
        const isHtml = !!props.isHtml;
        if (!subject)
            throw new Error('Send Email step missing subject');
        if (!body)
            throw new Error('Send Email step missing body');
        await this.notifications.sendMail({
            to,
            cc,
            bcc,
            subject,
            text: isHtml ? undefined : body,
            html: isHtml ? body : undefined,
        });
        this.logger.log(`📧 Send Email sent to ${to.join(', ')}`);
    }
    async executeDelay(props) {
        const delayMs = props.duration || 1000;
        this.logger.log(`⏰ Delay step - Waiting ${delayMs}ms`);
        return new Promise(resolve => setTimeout(resolve, delayMs));
    }
    async executeAddTag(props, context) {
        const tags = Array.isArray(props.tags)
            ? props.tags
            : (props.tag ? [props.tag] : []);
        let contactId = props.contactId || context.contactId;
        if (!tags || tags.length === 0) {
            throw new Error('Add Tag step requires at least one tag to add');
        }
        this.logger.log(`🏷️ Add Tag step - Adding ${tags.length} tag(s) to contact ${contactId}`);
        try {
            if (!contactId) {
                if (context.contactId) {
                    contactId = context.contactId;
                }
                else if (context.bookingId) {
                    const booking = await this.prisma.booking.findUnique({
                        where: { id: context.bookingId },
                        include: { event_type: true }
                    });
                    if (booking) {
                        const contact = await this.prisma.contact.findFirst({
                            where: {
                                user_id: context.userId,
                                email: booking.email
                            }
                        });
                        if (contact) {
                            contactId = contact.id;
                        }
                    }
                }
            }
            if (!contactId) {
                if (context.bookingId) {
                    const booking = await this.prisma.booking.findUnique({ where: { id: context.bookingId } });
                    if (booking?.email) {
                        const existing = await this.prisma.contact.findFirst({ where: { user_id: context.userId, email: booking.email } });
                        if (existing) {
                            contactId = existing.id;
                        }
                        else {
                            const created = await this.prisma.contact.create({
                                data: {
                                    user_id: context.userId,
                                    name: booking.name || booking.email,
                                    email: booking.email,
                                    favorite: false,
                                }
                            });
                            contactId = created.id;
                        }
                    }
                }
            }
            if (!contactId) {
                throw new Error('No contact ID available for Add Tag step');
            }
            for (const tagName of tags) {
                let tag = await this.prisma.tag.findFirst({
                    where: {
                        user_id: context.userId,
                        name: tagName.trim()
                    }
                });
                if (!tag) {
                    tag = await this.prisma.tag.create({
                        data: {
                            user_id: context.userId,
                            name: tagName.trim()
                        }
                    });
                    this.logger.log(`✅ Created new tag: "${tagName}"`);
                }
                const existingRelation = await this.prisma.contactTag.findFirst({
                    where: {
                        contact_id: contactId,
                        tag_id: tag.id
                    }
                });
                if (!existingRelation) {
                    await this.prisma.contactTag.create({
                        data: {
                            contact_id: contactId,
                            tag_id: tag.id
                        }
                    });
                    this.logger.log(`✅ Successfully added tag "${tagName}" to contact ${contactId}`);
                    try {
                        await this.onTagAdded(context.userId, tagName, contactId);
                        this.logger.log(`🔄 Triggered workflow execution for newly added tag "${tagName}"`);
                    }
                    catch (workflowError) {
                        this.logger.warn(`⚠️ Failed to trigger workflows for tag "${tagName}": ${workflowError.message}`);
                    }
                }
                else {
                    this.logger.log(`ℹ️ Tag "${tagName}" already exists on contact ${contactId}`);
                }
            }
            this.logger.log(`🎉 Add Tag step completed successfully - added ${tags.length} tag(s) to contact ${contactId}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to add tags to contact ${contactId}: ${error.message}`);
            throw error;
        }
    }
    static addError(entry) {
        try {
            WorkflowExecutionService_1.errorLog.push(entry);
            if (WorkflowExecutionService_1.errorLog.length > WorkflowExecutionService_1.MAX_ERRORS) {
                WorkflowExecutionService_1.errorLog.splice(0, WorkflowExecutionService_1.errorLog.length - WorkflowExecutionService_1.MAX_ERRORS);
            }
        }
        catch { }
    }
    async getErrorsFor(userId, workflowId, limit = 50) {
        try {
            const where = { status: 'failed', run: { user_id: userId } };
            if (workflowId)
                where.run = { ...where.run, workflow_id: workflowId };
            const items = await this.prisma.workflowStepRun.findMany({
                where,
                orderBy: { started_at: 'desc' },
                take: Math.max(1, Math.min(limit, 100)),
                include: { run: true },
            });
            return items.map(it => ({
                ts: new Date(it.started_at).getTime(),
                userId: it.run.user_id,
                workflowId: it.run.workflow_id,
                workflowName: '',
                stepIndex: it.index,
                stepType: it.type,
                message: it.message || '',
                stack: it.error_stack || undefined,
            }));
        }
        catch (e) {
            const filtered = WorkflowExecutionService_1.errorLog
                .filter(e => e.userId === userId && (!workflowId || e.workflowId === workflowId))
                .sort((a, b) => b.ts - a.ts)
                .slice(0, Math.max(1, Math.min(limit, 100)));
            return filtered;
        }
    }
    async getRuns(userId, workflowId, limit = 20) {
        const max = Math.max(1, Math.min(limit, 100));
        let dbRuns = [];
        try {
            dbRuns = await this.prisma.workflowRun.findMany({
                where: { user_id: userId, workflow_id: workflowId },
                orderBy: { started_at: 'desc' },
                take: max,
            });
        }
        catch (e) {
            this.logger.warn(`Runs listing failed (likely migration not applied): ${e?.message || e}`);
        }
        const memRuns = WorkflowExecutionService_1.runLog
            .filter(r => r.user_id === userId && r.workflow_id === workflowId);
        const map = new Map();
        for (const r of dbRuns)
            map.set(r.id, r);
        for (const r of memRuns)
            if (!map.has(r.id))
                map.set(r.id, r);
        return Array.from(map.values()).sort((a, b) => +new Date(b.started_at || b.startedAt || 0) - +new Date(a.started_at || a.startedAt || 0)).slice(0, max);
    }
    async getRunDetails(userId, workflowId, runId) {
        try {
            const run = await this.prisma.workflowRun.findFirst({
                where: { id: runId, user_id: userId, workflow_id: workflowId },
                include: { steps: { orderBy: { index: 'asc' } } },
            });
            if (run)
                return run;
        }
        catch (e) {
            this.logger.warn(`Run details failed (likely migration not applied): ${e?.message || e}`);
        }
        const r = WorkflowExecutionService_1.runLog.find(r => r.id === runId && r.user_id === userId && r.workflow_id === workflowId);
        if (!r)
            return null;
        return {
            id: r.id,
            user_id: r.user_id,
            workflow_id: r.workflow_id,
            status: r.status,
            trigger: r.trigger,
            context: r.context,
            started_at: r.started_at,
            finished_at: r.finished_at,
            steps: r.steps.map(s => ({
                index: s.index,
                type: s.type,
                status: s.status,
                message: s.message || null,
                error_stack: s.error_stack || null,
            })),
        };
    }
};
exports.WorkflowExecutionService = WorkflowExecutionService;
exports.WorkflowExecutionService = WorkflowExecutionService = WorkflowExecutionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        workflows_service_1.WorkflowsService,
        notifications_service_1.NotificationsService])
], WorkflowExecutionService);
//# sourceMappingURL=workflow-execution.service.js.map