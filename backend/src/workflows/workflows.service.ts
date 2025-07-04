import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
}

@Injectable()
export class WorkflowsService {
  private workflows: Workflow[] = [];

  list(userId: string) {
    return this.workflows.filter(w => w.userId === userId);
  }

  create(userId: string, data: Pick<Workflow, 'name' | 'description'>) {
    const workflow = { id: randomUUID(), userId, ...data };
    this.workflows.push(workflow);
    return workflow;
  }
}
