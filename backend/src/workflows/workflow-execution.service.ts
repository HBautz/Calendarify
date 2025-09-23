import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkflowsService } from './workflows.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface WorkflowExecutionContext {
  userId: string;
  eventType?: string;
  tagName?: string;
  bookingId?: string;
  contactId?: string;
  [key: string]: any;
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);
  // In-memory rolling error log for recent workflow execution errors
  private static errorLog: Array<{
    ts: number;
    userId: string;
    workflowId: string;
    workflowName: string;
    stepIndex: number;
    stepType: string;
    message: string;
    stack?: string;
  }> = [];
  private static readonly MAX_ERRORS = 200;

  // In-memory run log fallback when DB migrations are not applied
  private static runLog: Array<{
    id: string;
    user_id: string;
    workflow_id: string;
    status: 'running' | 'success' | 'partial' | 'failed';
    trigger?: string | null;
    context?: any;
    started_at: Date;
    finished_at?: Date | null;
    steps: Array<{
      index: number;
      type: string;
      status: 'running' | 'success' | 'failed';
      message?: string | null;
      error_stack?: string | null;
    }>;
  }> = [];

  constructor(
    private prisma: PrismaService,
    private workflowsService: WorkflowsService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Execute workflows triggered by a meeting being scheduled
   */
  async onMeetingScheduled(userId: string, eventTypeTitle: string, bookingId: string, eventTypeId?: string) {
    this.logger.log(`🔔 Meeting scheduled for user ${userId}, event type: ${eventTypeTitle}`);
    
    try {
      // Get all active workflows for this user
      const workflows = await this.workflowsService.list(userId);
      
      // Filter workflows that are triggered by "Meeting Scheduled"
      const meetingScheduledWorkflows = workflows.filter(workflow => {
        const workflowData = workflow.data || workflow;
        return workflow.status === true && workflowData.trigger === 'Meeting Scheduled';
      });

      this.logger.log(`📋 Found ${meetingScheduledWorkflows.length} Meeting Scheduled workflows`);

      for (const workflow of meetingScheduledWorkflows) {
        const workflowData = workflow.data || workflow;
        const triggerEventTypes: string[] = Array.isArray(workflowData.triggerEventTypes) ? workflowData.triggerEventTypes : [];
        const triggerEventTypeIds: string[] = Array.isArray((workflowData as any).triggerEventTypeIds) ? (workflowData as any).triggerEventTypeIds : [];
        
        // Case-insensitive matching for event type titles
        const titleMatch = triggerEventTypes.map(t => String(t).toLowerCase().trim()).includes(String(eventTypeTitle).toLowerCase().trim());
        const idMatch = eventTypeId ? triggerEventTypeIds.includes(String(eventTypeId)) : false;
        const match = (triggerEventTypes.length === 0 && triggerEventTypeIds.length === 0) || titleMatch || idMatch;

        this.logger.log(
          `🔍 Workflow "${workflow.name}": triggerTitles=${JSON.stringify(triggerEventTypes)} triggerIds=${JSON.stringify(triggerEventTypeIds)}; incoming title="${eventTypeTitle}" id=${eventTypeId}; match=${match}`
        );

        // Check if this workflow should trigger for this event type
        if (match) {
          this.logger.log(`⚡ Executing workflow: ${workflow.name} for event type: ${eventTypeTitle}`);
          
          const context: WorkflowExecutionContext = {
            userId,
            eventType: eventTypeTitle,
            bookingId,
          };
          
          await this.executeWorkflow(workflow, context);
        } else {
          this.logger.log(`❌ Skipping workflow: ${workflow.name} — event type mismatch`);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error executing Meeting Scheduled workflows: ${error.message}`, error.stack);
    }
  }

  /**
   * Execute workflows triggered by a tag being added to a contact
   */
  async onTagAdded(userId: string, tagName: string, contactId: string) {
    this.logger.log(`🏷️ Tag "${tagName}" added to contact ${contactId} for user ${userId}`);
    
    try {
      // Get all active workflows for this user
      const workflows = await this.workflowsService.list(userId);
      this.logger.log(`📋 Total workflows found for user: ${workflows.length}`);
      
      // Log all workflows for debugging
      workflows.forEach((workflow, index) => {
        const workflowData = workflow.data || workflow;
        this.logger.log(`📝 Workflow ${index + 1}: "${workflow.name}" - Status: ${workflow.status}, Trigger: ${workflowData.trigger}, TriggerTags: ${JSON.stringify(workflowData.triggerTags || [])}`);
      });
      
      // Filter workflows that are triggered by "Tag Added"
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
        
        // Check if this workflow should trigger for this tag
        this.logger.log(`🔍 Checking if workflow "${workflow.name}" should trigger for tag "${tagName}"`);
        this.logger.log(`   Trigger tags: ${JSON.stringify(triggerTags)}`);
        this.logger.log(`   Tag to match: ${tagName}`);
        
        if (triggerTags.length === 0 || triggerTags.includes(tagName)) {
          this.logger.log(`✅ Workflow "${workflow.name}" should trigger for tag "${tagName}"`);
          this.logger.log(`⚡ Executing workflow: ${workflow.name} for tag: ${tagName}`);
          
          const context: WorkflowExecutionContext = {
            userId,
            tagName,
            contactId,
          };
          
          await this.executeWorkflow(workflow, context);
        } else {
          this.logger.log(`❌ Workflow "${workflow.name}" should NOT trigger for tag "${tagName}"`);
          this.logger.log(`   Required tags: ${JSON.stringify(triggerTags)}`);
          this.logger.log(`   Provided tag: ${tagName}`);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error executing Tag Added workflows: ${error.message}`, error.stack);
    }
  }

  /**
   * Execute a workflow's steps
   */
  private async executeWorkflow(workflow: any, context: WorkflowExecutionContext) {
    const workflowData = workflow.data || workflow;
    const steps = workflowData.steps || [];

    this.logger.log(`🚀 Executing workflow "${workflow.name}" with ${steps.length} steps`);

    // Optionally attach full payload (contact/booking) for step access
    try {
      await this.attachContextPayload(workflowData, context);
    } catch (e) {
      this.logger.warn(`⚠️ Failed to attach full context payload: ${e?.message || e}`);
    }

    // Create run record (guard if migration not applied)
    let run: any = null;
    let ephemeralRunId: string | null = null;
    try {
      run = await this.prisma.workflowRun.create({
        data: {
          user_id: workflow.userId,
          workflow_id: workflow.id,
          status: 'running',
          trigger: workflowData.trigger || undefined,
          context: context as any,
        },
      });
    } catch (e) {
      this.logger.warn(`⚠️ Could not persist workflow run (migration pending?): ${e?.message || e}`);
      // Fallback to in-memory run tracking
      ephemeralRunId = `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      WorkflowExecutionService.runLog.push({
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

    // Support simple branching with If / Else / End If control nodes
    type Block = { conditionTrue: boolean; inElse: boolean };
    const stack: Block[] = [];
    const computeSkipping = () => stack.some(b => (b.inElse ? b.conditionTrue : !b.conditionTrue));
    let skipping = false;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const type = String(step?.type || '');
      this.logger.log(`📝 Executing step ${i + 1}/${steps.length}: ${type}`);

      // Create step run record in running state (optional if run persisted)
      let stepRun: any = null;
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
        } catch (e) {
          this.logger.warn(`⚠️ Could not persist step run: ${e?.message || e}`);
        }
      } else if (ephemeralRunId) {
        const r = WorkflowExecutionService.runLog.find(r => r.id === ephemeralRunId);
        if (r) r.steps.push({ index: i, type: type || 'Unknown', status: 'running' });
      }

      try {
        // Control-flow handling
        if (type === 'If') {
          delete (context as any).__lastStepMessage;
          await this.executeIf((step.props ?? step.properties ?? step.data?.properties) || {}, context);
          const condTrue = !((context as any).__skipNextStep === true);
          // Record result keyed by ifId for gating
          try {
            const ifId = String(((step && (step.props ?? step.properties ?? step.data?.properties)) || {}).ifId || '');
            if (ifId) (context as any)[`if:${ifId}`] = !!condTrue;
          } catch {}
          stack.push({ conditionTrue: condTrue, inElse: false });
          skipping = computeSkipping();
          this.logger.log(`🔀 If evaluated to ${condTrue ? 'TRUE' : 'FALSE'}`);
          // Mark success with detail message
          succeeded++;
          if (stepRun) {
            try {
              await this.prisma.workflowStepRun.update({
                where: { id: stepRun.id },
                data: {
                  status: 'success',
                  finished_at: new Date(),
                  message: (context as any).__lastStepMessage ? String((context as any).__lastStepMessage) : `If => ${condTrue}`,
                },
              });
            } catch {}
          } else if (ephemeralRunId) {
            const r = WorkflowExecutionService.runLog.find(r => r.id === ephemeralRunId);
            if (r) {
              const s = r.steps.find(s => s.index === i);
              if (s) {
                s.status = 'success';
                s.message = (context as any).__lastStepMessage ? String((context as any).__lastStepMessage) : `If => ${condTrue}`;
              }
            }
          }
          continue;
        } else if (type === 'Else') {
          const top = stack[stack.length - 1];
          if (top) {
            top.inElse = true;
            skipping = computeSkipping();
          }
          // Record Else as informational step
          succeeded++;
          if (stepRun) {
            try {
              await this.prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: 'success', finished_at: new Date(), message: 'Else' } });
            } catch {}
          } else if (ephemeralRunId) {
            const r = WorkflowExecutionService.runLog.find(r => r.id === ephemeralRunId);
            if (r) { const s = r.steps.find(s => s.index === i); if (s) { s.status = 'success'; s.message = 'Else'; } }
          }
          continue;
        } else if (type === 'End If') {
          if (stack.length > 0) stack.pop();
          skipping = computeSkipping();
          // Record End If as informational step
          succeeded++;
          if (stepRun) {
            try { await this.prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: 'success', finished_at: new Date(), message: 'End If' } }); } catch {}
          } else if (ephemeralRunId) {
            const r = WorkflowExecutionService.runLog.find(r => r.id === ephemeralRunId);
            if (r) { const s = r.steps.find(s => s.index === i); if (s) { s.status = 'success'; s.message = 'End If'; } }
          }
          continue;
        }

        // For regular steps: honor skipping and new branch gating
        const meta = ((step && (step.props ?? step.properties ?? step.data?.properties)) || {}) as any;
        const gateIf = meta.parentIfId ? String(meta.parentIfId) : null;
        if (gateIf) {
          const flagKey = `if:${gateIf}`;
          const condTrue = (context as any)[flagKey];
          const shouldRun = meta.branch === 'true' ? !!condTrue : !condTrue;
          if (!shouldRun) {
            this.logger.log(`⏭️ Skipping step ${i + 1} (${type}) by branch gate`);
            succeeded++;
            if (stepRun) {
              try { await this.prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: 'success', finished_at: new Date(), message: 'Skipped by branch condition' } }); } catch {}
            } else if (ephemeralRunId) {
              const r = WorkflowExecutionService.runLog.find(r => r.id === ephemeralRunId);
              if (r) { const s = r.steps.find(s => s.index === i); if (s) { s.status = 'success'; s.message = 'Skipped by branch condition'; } }
            }
            continue;
          }
        } else if (skipping) {
          this.logger.log(`⏭️ Skipping step ${i + 1} (${type}) due to branch`);
          succeeded++;
          if (stepRun) {
            try { await this.prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: 'success', finished_at: new Date(), message: 'Skipped by branch condition' } }); } catch {}
          } else if (ephemeralRunId) {
            const r = WorkflowExecutionService.runLog.find(r => r.id === ephemeralRunId);
            if (r) { const s = r.steps.find(s => s.index === i); if (s) s.status = 'success'; if (s) s.message = 'Skipped by branch condition'; }
          }
          continue;
        }

        // Execute step normally
        delete (context as any).__lastStepMessage;
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
                message: (context as any).__lastStepMessage ? String((context as any).__lastStepMessage) : undefined,
              },
            });
          } catch {}
        } else if (ephemeralRunId) {
          const r = WorkflowExecutionService.runLog.find(r => r.id === ephemeralRunId);
          if (r) {
            const s = r.steps.find(s => s.index === i);
            if (s) s.status = 'success';
            if (s && (context as any).__lastStepMessage) s.message = String((context as any).__lastStepMessage);
          }
        }
      } catch (error) {
        failed++;
        this.logger.error(`❌ Step ${i + 1} failed: ${error.message}`, error.stack);
        WorkflowExecutionService.addError({
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
          } catch {}
        } else if (ephemeralRunId) {
          const r = WorkflowExecutionService.runLog.find(r => r.id === ephemeralRunId);
          if (r) {
            const s = r.steps.find(s => s.index === i);
            if (s) {
              s.status = 'failed';
              s.message = String(error?.message || error || 'Unknown error');
              s.error_stack = error?.stack ? String(error.stack) : undefined;
            }
          }
        }
        // Continue with next step instead of stopping the entire workflow
      }
    }

    // Determine final status
    const finalStatus = failed === 0 ? 'success' : (succeeded > 0 ? 'partial' : 'failed');
    if (run) {
      try {
        await this.prisma.workflowRun.update({
          where: { id: run.id },
          data: { status: finalStatus as any, finished_at: new Date() },
        });
      } catch {}
    } else if (ephemeralRunId) {
      const r = WorkflowExecutionService.runLog.find(r => r.id === ephemeralRunId);
      if (r) {
        r.status = finalStatus as any;
        r.finished_at = new Date();
      }
    }

    this.logger.log(`🎉 Workflow "${workflow.name}" execution completed with status ${finalStatus}`);
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: any, context: WorkflowExecutionContext) {
    const type = step?.type;
    // Normalize props from various shapes produced by editor
    const rawProps = (step && (step.props ?? step.properties ?? step.data?.properties)) || {};
    const props = rawProps;
    
    switch (type) {
      case 'True':
      case 'False':
        (context as any).__lastStepMessage = type;
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

  /**
   * Execute If step: evaluate condition against context payload (contact/booking/etc.)
   * Sets context.__skipNextStep = true when condition evaluates to false
   */
  private async executeIf(props: any, context: WorkflowExecutionContext) {
    const field: string = String(props.field || '').trim();
    const operator: string = String(props.operator || '').trim();
    const value: any = props.value;
    const missingBehavior: string | undefined = props.missingDataBehavior;

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
      detail = `If ${field} ${operator}${value !== undefined && !['exists','not_exists'].includes(operator) ? ' ' + JSON.stringify(value) : ''} => ${JSON.stringify(actual)} => ${result}`;
    } catch (e) {
      // For Tag Added flows UI suggests defaulting to false path on evaluation errors
      if (missingBehavior === 'default_false_path_on_error') {
        result = false;
        detail = `If evaluation error, defaulted to false path: ${e?.message || e}`;
      } else {
        throw e;
      }
    }

    // Place a message for run logs and signal skip if false
    (context as any).__lastStepMessage = detail;
    (context as any).__skipNextStep = !result;
  }

  /**
   * Test helper: evaluate an If step without persisting runs or mutating DB.
   * Pass full values in context.contact/context.booking to avoid DB lookups.
   */
  public async evaluateIfForTest(props: any, context: WorkflowExecutionContext): Promise<{ result: boolean; detail: string; actual: any; }>{
    // Ensure we do not accidentally fetch/write: if ids are present, ignore them here
    const sandboxContext: any = {
      userId: context.userId,
      // Only use provided payloads; do not use IDs to fetch
      contact: (context as any).contact || undefined,
      booking: (context as any).booking || undefined,
    };
    await this.executeIf(props, sandboxContext as WorkflowExecutionContext);
    const result = !((sandboxContext as any).__skipNextStep === true);
    const detail = String((sandboxContext as any).__lastStepMessage || '');
    const actual = await this.resolveFieldValue(String(props.field || ''), sandboxContext as WorkflowExecutionContext);
    return { result, detail, actual };
  }

  // Utility: attempt to attach contact/booking payload to context
  private async attachContextPayload(workflowData: any, context: WorkflowExecutionContext) {
    const wantFull = !!(workflowData?.contextSpec?.attachFullContext);
    if (!wantFull) return;

    // Attach booking if available
    if (context.bookingId) {
      try {
        const booking = await this.prisma.booking.findUnique({ where: { id: context.bookingId }, include: { event_type: true } });
        if (booking) {
          (context as any).booking = {
            id: booking.id,
            title: booking.event_type?.title || undefined,
            eventType: booking.event_type?.title || undefined,
            name: (booking as any).name || undefined,
            email: (booking as any).email || undefined,
            startTime: booking.starts_at?.toISOString?.() || booking.starts_at,
            endTime: booking.ends_at?.toISOString?.() || booking.ends_at,
          };
        }
      } catch {}
    }

    // Attach contact if available, or infer from booking email
    if (context.contactId) {
      try {
        const contact = await this.prisma.contact.findUnique({ where: { id: context.contactId } });
        if (contact) {
          (context as any).contact = {
            id: contact.id,
            name: contact.name || undefined,
            email: contact.email || undefined,
            phone: (contact as any).phone || undefined,
            company: (contact as any).company || undefined,
            createdAt: contact.created_at,
            updatedAt: contact.updated_at,
          };
        }
      } catch {}
    } else if (!context.contactId && (context as any).booking && (context as any).booking.email) {
      try {
        const existing = await this.prisma.contact.findFirst({ where: { user_id: context.userId, email: (context as any).booking.email } });
        if (existing) {
          context.contactId = existing.id;
          (context as any).contact = {
            id: existing.id,
            name: existing.name || undefined,
            email: existing.email || undefined,
            phone: (existing as any).phone || undefined,
            company: (existing as any).company || undefined,
            createdAt: existing.created_at,
            updatedAt: existing.updated_at,
          };
        }
      } catch {}
    }
  }

  // Utility: Resolve a dot-path value from context/payload
  private async resolveFieldValue(path: string, context: WorkflowExecutionContext): Promise<any> {
    const parts = path.split('.');
    const root = parts.shift();
    const tail = parts.join('.');

    const getByPath = (obj: any, p: string) => {
      if (!obj) return undefined;
      if (!p) return obj;
      return p.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
    };

    if (root === 'contact') {
      if (!(context as any).contact && context.contactId) {
        try {
          const contact = await this.prisma.contact.findUnique({ where: { id: context.contactId } });
          if (contact) (context as any).contact = contact;
        } catch {}
      }
      const val = getByPath((context as any).contact, tail);
      // Fallback: if requesting contact.email but contact is not yet attached, use booking.email when available
      if ((val == null || val === undefined) && tail === 'email' && (context as any).booking && (context as any).booking.email) {
        return (context as any).booking.email;
      }
      return val;
    }
    if (root === 'booking') {
      if (!(context as any).booking && context.bookingId) {
        try {
          const booking = await this.prisma.booking.findUnique({ where: { id: context.bookingId }, include: { event_type: true } });
          if (booking) (context as any).booking = { ...booking, eventType: booking.event_type?.title } as any;
        } catch {}
      }
      return getByPath((context as any).booking, tail);
    }
    // Fall back to top-level context values
    return getByPath(context as any, [root, tail].filter(Boolean).join('.'));
  }

  private coerceEquals(a: any, b: any): boolean {
    // Numeric compare if both parse as finite numbers
    const na = Number(a); const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
    // Array membership: equals when array contains scalar
    if (Array.isArray(a) && !Array.isArray(b)) return a.map(x => String(x)).includes(String(b));
    if (!Array.isArray(a) && Array.isArray(b)) return b.map(x => String(x)).includes(String(a));
    return String(a) === String(b);
  }

  private coerceContains(a: any, b: any): boolean {
    if (Array.isArray(a)) return a.map(x => String(x)).includes(String(b));
    if (a == null) return false;
    return String(a).includes(String(b));
  }

  private coerceCompare(a: any, b: any, op: 'gt' | 'lt'): boolean {
    const na = Number(a); const nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) throw new Error('Non-numeric comparison');
    return op === 'gt' ? na > nb : na < nb;
  }

  /**
   * Execute Send Email step
   */
  private async executeSendEmail(props: any, context: WorkflowExecutionContext) {
    // Resolve recipients
    const useTriggerRecipient = props.useTriggerRecipient === true || (!props.to || (Array.isArray(props.to) && props.to.length === 0));
    let to: string[] = [];
    if (useTriggerRecipient) {
      if (context.contactId) {
        const contact = await this.prisma.contact.findUnique({ where: { id: context.contactId } });
        if (contact?.email) to = [contact.email];
      } else if (context.bookingId) {
        const booking = await this.prisma.booking.findUnique({ where: { id: context.bookingId } });
        if (booking?.email) to = [booking.email];
      }
      if (to.length === 0) {
        throw new Error('No recipient found for Send Email step');
      }
    } else {
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
    if (!subject) throw new Error('Send Email step missing subject');
    if (!body) throw new Error('Send Email step missing body');

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

  /**
   * Execute Delay step
   */
  private async executeDelay(props: any) {
    const delayMs = props.duration || 1000; // Default to 1 second
    this.logger.log(`⏰ Delay step - Waiting ${delayMs}ms`);
    
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Execute Add Tag step
   */
  private async executeAddTag(props: any, context: WorkflowExecutionContext) {
    // Editor may send either { tag: string } or { tags: string[] }
    const tags: string[] = Array.isArray(props.tags)
      ? props.tags
      : (props.tag ? [props.tag] : []);
    let contactId = props.contactId || context.contactId;
    
    if (!tags || tags.length === 0) {
      throw new Error('Add Tag step requires at least one tag to add');
    }
    
    this.logger.log(`🏷️ Add Tag step - Adding ${tags.length} tag(s) to contact ${contactId}`);
    
    try {
      // If no specific contact ID, try to get it from context
      if (!contactId) {
        if (context.contactId) {
          contactId = context.contactId;
        } else if (context.bookingId) {
          // Try to get contact from booking
          const booking = await this.prisma.booking.findUnique({
            where: { id: context.bookingId },
            include: { event_type: true }
          });
          if (booking) {
            // Find contact by email from the booking
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
        // As a fallback, if we have a booking, upsert contact from booking details
        if (context.bookingId) {
          const booking = await this.prisma.booking.findUnique({ where: { id: context.bookingId } });
          if (booking?.email) {
            const existing = await this.prisma.contact.findFirst({ where: { user_id: context.userId, email: booking.email } });
            if (existing) {
              contactId = existing.id;
            } else {
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
      
      // Process each tag
      for (const tagName of tags) {
        // Find or create the tag
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
        
        // Check if contact-tag relationship already exists
        const existingRelation = await this.prisma.contactTag.findFirst({
          where: {
            contact_id: contactId,
            tag_id: tag.id
          }
        });
        
        if (!existingRelation) {
          // Create the contact-tag relationship
          await this.prisma.contactTag.create({
            data: {
              contact_id: contactId,
              tag_id: tag.id
            }
          });
          
          this.logger.log(`✅ Successfully added tag "${tagName}" to contact ${contactId}`);
          
          // IMPORTANT: Trigger workflows for this newly added tag
          // This ensures that workflows with "Tag Added" trigger can cascade
          // (e.g., workflow A adds tag "Lead" → triggers workflow B that adds tag "VIP")
          try {
            await this.onTagAdded(context.userId, tagName, contactId);
            this.logger.log(`🔄 Triggered workflow execution for newly added tag "${tagName}"`);
          } catch (workflowError) {
            this.logger.warn(`⚠️ Failed to trigger workflows for tag "${tagName}": ${workflowError.message}`);
            // Don't fail the entire step if workflow triggering fails
          }
        } else {
          this.logger.log(`ℹ️ Tag "${tagName}" already exists on contact ${contactId}`);
        }
      }
      
      this.logger.log(`🎉 Add Tag step completed successfully - added ${tags.length} tag(s) to contact ${contactId}`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to add tags to contact ${contactId}: ${error.message}`);
      throw error;
    }
  }

  // Error log helpers
  static addError(entry: { ts: number; userId: string; workflowId: string; workflowName: string; stepIndex: number; stepType: string; message: string; stack?: string; }) {
    try {
      WorkflowExecutionService.errorLog.push(entry);
      if (WorkflowExecutionService.errorLog.length > WorkflowExecutionService.MAX_ERRORS) {
        WorkflowExecutionService.errorLog.splice(0, WorkflowExecutionService.errorLog.length - WorkflowExecutionService.MAX_ERRORS);
      }
    } catch {}
  }

  async getErrorsFor(userId: string, workflowId?: string, limit = 50) {
    // Prefer persisted step failures; fall back to in-memory if table not available
    try {
      const where: any = { status: 'failed', run: { user_id: userId } };
      if (workflowId) where.run = { ...where.run, workflow_id: workflowId };
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
    } catch (e) {
      const filtered = WorkflowExecutionService.errorLog
        .filter(e => e.userId === userId && (!workflowId || e.workflowId === workflowId))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, Math.max(1, Math.min(limit, 100)));
      return filtered;
    }
  }

  async getRuns(userId: string, workflowId: string, limit = 20) {
    const max = Math.max(1, Math.min(limit, 100));
    let dbRuns: any[] = [];
    try {
      dbRuns = await this.prisma.workflowRun.findMany({
        where: { user_id: userId, workflow_id: workflowId },
        orderBy: { started_at: 'desc' },
        take: max,
      });
    } catch (e) {
      this.logger.warn(`Runs listing failed (likely migration not applied): ${e?.message || e}`);
    }

    // Always consider in-memory runs and merge
    const memRuns = WorkflowExecutionService.runLog
      .filter(r => r.user_id === userId && r.workflow_id === workflowId);

    // Normalize and merge
    const map = new Map<string, any>();
    for (const r of dbRuns) map.set(r.id, r);
    for (const r of memRuns) if (!map.has(r.id)) map.set(r.id, r);
    return Array.from(map.values()).sort((a: any, b: any) => +new Date(b.started_at || b.startedAt || 0) - +new Date(a.started_at || a.startedAt || 0)).slice(0, max);
  }

  async getRunDetails(userId: string, workflowId: string, runId: string) {
    try {
      const run = await this.prisma.workflowRun.findFirst({
        where: { id: runId, user_id: userId, workflow_id: workflowId },
        include: { steps: { orderBy: { index: 'asc' } } },
      });
      if (run) return run;
    } catch (e) {
      this.logger.warn(`Run details failed (likely migration not applied): ${e?.message || e}`);
    }
    // Fallback to in-memory if DB not available or run not found
    const r = WorkflowExecutionService.runLog.find(r => r.id === runId && r.user_id === userId && r.workflow_id === workflowId);
    if (!r) return null;
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
    } as any;
  }
}
