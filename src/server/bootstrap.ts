import { db } from "@/db";
import { courses, holes } from "@/db/schema";
import { WOODSIDE_HOLES } from "@/lib/scoring";

/** Seed the Woodside course on a fresh database. */
export async function ensureDefaultCourse() {
  const existing = await db.select({ id: courses.id }).from(courses).limit(1);
  if (existing.length) return existing[0].id;
  const [course] = await db.insert(courses).values({ name: "Woodside" }).returning();
  await db.insert(holes).values(WOODSIDE_HOLES.map((h) => ({ ...h, courseId: course.id })));
  return course.id;
}
