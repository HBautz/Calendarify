/*
  Cascade delete a user and all related data, with JSON backup.
  Usage:
    DELETE_EMAIL=admin@admin.com node backend/scripts/delete-user-cascade.js
*/
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const os = require('os');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DELETE_EMAIL || 'admin@admin.com';
  console.log('[DELETE][START]', email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('[DELETE] user not found');
    return;
  }
  const userId = user.id;

  // Collect related data for backup
  const [
    eventTypes,
    bookings,
    bookingNotes,
    availabilityRules,
    availabilityOverrides,
    externalCalendars,
    userState,
    tags,
    contacts,
    contactTags,
    workflows,
    workflowRuns,
    workflowDrafts,
    workflowStepRuns
  ] = await Promise.all([
    prisma.eventType.findMany({ where: { user_id: userId } }),
    prisma.booking.findMany({ where: { user_id: userId } }),
    prisma.bookingNote.findMany({ where: { booking: { user_id: userId } } }),
    prisma.availabilityRule.findMany({ where: { user_id: userId } }),
    prisma.availabilityOverride.findMany({ where: { user_id: userId } }),
    prisma.externalCalendar.findMany({ where: { user_id: userId } }),
    prisma.userState.findUnique({ where: { user_id: userId } }),
    prisma.tag.findMany({ where: { user_id: userId } }),
    prisma.contact.findMany({ where: { user_id: userId } }),
    prisma.contactTag.findMany({ where: { OR: [ { contact: { user_id: userId } }, { tag: { user_id: userId } } ] } }),
    prisma.workflow.findMany({ where: { user_id: userId } }),
    prisma.workflowRun.findMany({ where: { user_id: userId } }),
    prisma.workflowDraft.findMany({ where: { user_id: userId } }),
    prisma.workflowStepRun.findMany({ where: { run: { user_id: userId } } }),
  ]);

  const backup = {
    user,
    eventTypes,
    bookings,
    bookingNotes,
    availabilityRules,
    availabilityOverrides,
    externalCalendars,
    userState,
    tags,
    contacts,
    contactTags,
    workflows,
    workflowRuns,
    workflowDrafts,
    workflowStepRuns,
    createdAt: new Date().toISOString(),
  };

  // Write backups OUTSIDE the repository to avoid committing secrets by accident
  // Prefer env CALENDARIFY_BACKUP_DIR; fallback to ~/calendarify/backups
  const backupDir = process.env.CALENDARIFY_BACKUP_DIR
    ? path.resolve(process.env.CALENDARIFY_BACKUP_DIR)
    : path.join(os.homedir(), 'calendarify', 'backups');
  try { fs.mkdirSync(backupDir, { recursive: true }); } catch {}
  const safeEmail = email.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const backupPath = path.join(backupDir, `backup-user-${safeEmail}-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log('[DELETE][BACKUP_SAVED]', backupPath);
  console.log('[DELETE][BACKUP_HINT] Set CALENDARIFY_BACKUP_DIR to control backup location.');

  // Delete in FK-safe order inside a transaction
  const runIds = workflowRuns.map(r => r.id);
  const bookingIds = bookings.map(b => b.id);
  const contactIds = contacts.map(c => c.id);
  const tagIds = tags.map(t => t.id);
  const workflowIds = workflows.map(w => w.id);

  await prisma.$transaction(async (tx) => {
    // Step runs -> runs -> drafts -> booking notes -> bookings -> event types
    if (runIds.length) await tx.workflowStepRun.deleteMany({ where: { workflow_run_id: { in: runIds } } });
    if (workflowIds.length) await tx.workflowDraft.deleteMany({ where: { workflow_id: { in: workflowIds } } });
    if (runIds.length) await tx.workflowRun.deleteMany({ where: { id: { in: runIds } } });

    if (bookingIds.length) await tx.bookingNote.deleteMany({ where: { booking_id: { in: bookingIds } } });
    if (bookingIds.length) await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });

    await tx.eventType.deleteMany({ where: { user_id: userId } });
    await tx.availabilityOverride.deleteMany({ where: { user_id: userId } });
    await tx.availabilityRule.deleteMany({ where: { user_id: userId } });
    await tx.externalCalendar.deleteMany({ where: { user_id: userId } });

    // ContactTag has cascade, but ensure cleanup explicitly
    if (contactIds.length) await tx.contactTag.deleteMany({ where: { contact_id: { in: contactIds } } });
    if (tagIds.length) await tx.contactTag.deleteMany({ where: { tag_id: { in: tagIds } } });
    if (contactIds.length) await tx.contact.deleteMany({ where: { id: { in: contactIds } } });
    if (tagIds.length) await tx.tag.deleteMany({ where: { id: { in: tagIds } } });

    if (workflowIds.length) await tx.workflow.deleteMany({ where: { id: { in: workflowIds } } });
    await tx.userState.deleteMany({ where: { user_id: userId } });

    await tx.user.delete({ where: { id: userId } });
  });

  console.log('[DELETE][SUCCESS]', email);
}

main()
  .catch((e) => {
    console.error('[DELETE][ERROR]', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


