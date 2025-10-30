"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = slugify;
exports.generateUniqueSlug = generateUniqueSlug;
exports.generateUniqueUserSlug = generateUniqueUserSlug;
function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
async function generateUniqueSlug(prisma, text, excludeId) {
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
async function generateUniqueUserSlug(prisma, text, excludeId) {
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
//# sourceMappingURL=slug.utils.js.map