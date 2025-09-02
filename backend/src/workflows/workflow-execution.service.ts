import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkflowsService } from './workflows.service';

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

  constructor(
    private prisma: PrismaService,
    private workflowsService: WorkflowsService,
  ) {}

  /**
   * Execute workflows triggered by a meeting being scheduled
   */
  async onMeetingScheduled(userId: string, eventTypeTitle: string, bookingId: string) {
    this.logger.log(`🔔 Meeting scheduled for user ${userId}, event type: ${eventTypeTitle}`);
    
    try {
      // Get all active workflows for this user
      const workflows = await this.workflowsService.list(userId);
      
      // Filter workflows that are triggered by "Meeting Scheduled"
      const meetingScheduledWorkflows = workflows.filter(workflow => {
        const workflowData = workflow.data || workflow;
        return workflow.status === true && 
               workflowData.trigger === 'Meeting Scheduled';
      });

      this.logger.log(`📋 Found ${meetingScheduledWorkflows.length} Meeting Scheduled workflows`);

      for (const workflow of meetingScheduledWorkflows) {
        const workflowData = workflow.data || workflow;
        const triggerEventTypes = workflowData.triggerEventTypes || [];
        
        // Check if this workflow should trigger for this event type
        if (triggerEventTypes.length === 0 || triggerEventTypes.includes(eventTypeTitle)) {
          this.logger.log(`⚡ Executing workflow: ${workflow.name} for event type: ${eventTypeTitle}`);
          
          const context: WorkflowExecutionContext = {
            userId,
            eventType: eventTypeTitle,
            bookingId,
          };
          
          await this.executeWorkflow(workflow, context);
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
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.logger.log(`📝 Executing step ${i + 1}/${steps.length}: ${step.type}`);
      
      try {
        await this.executeStep(step, context);
        this.logger.log(`✅ Step ${i + 1} completed successfully`);
      } catch (error) {
        this.logger.error(`❌ Step ${i + 1} failed: ${error.message}`, error.stack);
        // Continue with next step instead of stopping the entire workflow
      }
    }
    
    this.logger.log(`🎉 Workflow "${workflow.name}" execution completed`);
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: any, context: WorkflowExecutionContext) {
    const { type, props = {} } = step;
    
    switch (type) {
      case 'Send Email':
        await this.executeSendEmail(props, context);
        break;
      case 'Delay':
        await this.executeDelay(props);
        break;
      case 'Add Tag':
        await this.executeAddTag(props, context);
        break;
      default:
        this.logger.warn(`⚠️ Unknown step type: ${type}`);
        break;
    }
  }

  /**
   * Execute Send Email step
   */
  private async executeSendEmail(props: any, context: WorkflowExecutionContext) {
    this.logger.log(`📧 Send Email step - Coming soon!`);
    this.logger.log(`   To: ${props.to || 'Not specified'}`);
    this.logger.log(`   Subject: ${props.subject || 'Not specified'}`);
    this.logger.log(`   Body: ${props.body || 'Not specified'}`);
    
    // TODO: Implement actual email sending
    // For now, just log the action
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
    const tags = props.tags || [];
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
                email: booking.name // Assuming booking.name contains email
              }
            });
            if (contact) {
              contactId = contact.id;
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
}
