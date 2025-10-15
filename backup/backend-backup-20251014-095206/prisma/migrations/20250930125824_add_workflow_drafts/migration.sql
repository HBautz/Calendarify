-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('running', 'success', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "WorkflowStepStatus" AS ENUM ('running', 'success', 'failed');

-- CreateTable
CREATE TABLE "WorkflowDraft" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'draft',
    "version" SERIAL NOT NULL,
    "name" TEXT,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'running',
    "trigger" TEXT,
    "context" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStepRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_run_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WorkflowStepStatus" NOT NULL DEFAULT 'running',
    "message" TEXT,
    "error_stack" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "WorkflowStepRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowDraft_user_id_workflow_id_branch_updated_at_idx" ON "WorkflowDraft"("user_id", "workflow_id", "branch", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDraft_workflow_id_branch_version_key" ON "WorkflowDraft"("workflow_id", "branch", "version");

-- CreateIndex
CREATE INDEX "WorkflowRun_user_id_workflow_id_started_at_idx" ON "WorkflowRun"("user_id", "workflow_id", "started_at");

-- CreateIndex
CREATE INDEX "WorkflowStepRun_workflow_run_id_index_idx" ON "WorkflowStepRun"("workflow_run_id", "index");

-- AddForeignKey
ALTER TABLE "WorkflowDraft" ADD CONSTRAINT "WorkflowDraft_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraft" ADD CONSTRAINT "WorkflowDraft_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepRun" ADD CONSTRAINT "WorkflowStepRun_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
