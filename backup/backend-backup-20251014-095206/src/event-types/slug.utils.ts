export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function generateUniqueSlug(
  prisma: { eventType: { findUnique: (args: any) => Promise<any> } },
  text: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(text);
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await prisma.eventType.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) {
      break;
    }
    slug = `${base}-${i++}`;
  }
  return slug;
}

export async function generateUniqueUserSlug(
  prisma: { user: { findUnique: (args: any) => Promise<any> } },
  text: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(text);
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await prisma.user.findUnique({ where: { display_name: slug } });
    if (!existing || existing.id === excludeId) {
      break;
    }
    slug = `${base}-${i++}`;
  }
  return slug;
}
