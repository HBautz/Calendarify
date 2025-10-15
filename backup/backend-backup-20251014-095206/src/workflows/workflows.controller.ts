import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkflowsService } from './workflows.service';
import { WorkflowExecutionService } from './workflow-execution.service';

@Controller('workflows')
export class WorkflowsController {
  constructor(
    private workflows: WorkflowsService,
    private execution: WorkflowExecutionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Request() req) {
    return this.workflows.list(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.workflows.findById(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Request() req,
    @Body() body: { name: string; description?: string; data?: any },
  ) {
    return this.workflows.create(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.workflows.remove(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.workflows.update(req.user.userId, id, body);
  }

  // ----- Drafts -----
  @UseGuards(JwtAuthGuard)
  @Get(':id/drafts')
  listDrafts(@Request() req, @Param('id') id: string, @Query('branch') branch?: string) {
    return this.workflows.listDrafts(req.user.userId, id, branch);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/draft-branches')
  listDraftBranches(@Request() req, @Param('id') id: string) {
    return this.workflows.listDraftBranches(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/drafts')
  createDraft(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { branch?: string; name?: string; data: any },
  ) {
    return this.workflows.createDraft(req.user.userId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/drafts/:draftId/apply')
  applyDraft(
    @Request() req,
    @Param('id') id: string,
    @Param('draftId') draftId: string,
  ) {
    return this.workflows.applyDraft(req.user.userId, id, draftId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/drafts')
  deleteDraftBranch(
    @Request() req,
    @Param('id') id: string,
    @Query('branch') branch: string,
  ) {
    return this.workflows.deleteDraftBranch(req.user.userId, id, branch);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/drafts/:draftId')
  renameDraft(
    @Request() req,
    @Param('id') id: string,
    @Param('draftId') draftId: string,
    @Body() body: { name: string },
  ) {
    try {
      // Debug log to trace rename inputs
      // eslint-disable-next-line no-console
      console.log('[DRAFT][API] rename request', {
        userId: req?.user?.userId,
        workflowId: id,
        draftId,
        newName: body?.name,
      });
    } catch {}
    return this.workflows.renameDraft(req.user.userId, id, draftId, body?.name || '');
  }

  // Latest execution errors (in-memory). For debugging in the editor.
  @UseGuards(JwtAuthGuard)
  @Get(':id/errors')
  errorsForWorkflow(
    @Request() req,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 50;
    return this.execution.getErrorsFor(req.user.userId, id, isNaN(lim) ? 50 : lim);
  }

  // Runs history
  @UseGuards(JwtAuthGuard)
  @Get(':id/runs')
  runsForWorkflow(
    @Request() req,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const lim = limit ? parseInt(limit, 10) : 20;
      return this.execution.getRuns(req.user.userId, id, isNaN(lim) ? 20 : lim);
    } catch (e) {
      return [];
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/runs/:runId')
  runDetails(
    @Request() req,
    @Param('id') id: string,
    @Param('runId') runId: string,
  ) {
    try {
      return this.execution.getRunDetails(req.user.userId, id, runId);
    } catch (e) {
      return null;
    }
  }
}
