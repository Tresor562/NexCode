import { botCourses } from './coursesBots';
import { devCourses } from './coursesDev';
import { webCourses } from './coursesWeb';
import { htmlMasteryLessons } from './htmlMastery';
import { guidedProjects } from './projects';
import { Course, makeCourse } from './curriculumCore';

export type { Course, CourseCategory, GuidedProject, Lesson } from './curriculumCore';
export { guidedProjects };

function extendCourse(course: Course, extraLessons = course.id === 'html-foundations' ? htmlMasteryLessons : []) {
  if (extraLessons.length === 0) return course;
  return makeCourse({
    id: course.id,
    title: course.title,
    language: course.language,
    category: course.category,
    level: course.level,
    offlineSizeMb: Math.max(course.offlineSizeMb, Math.ceil((course.starterLessons.length + extraLessons.length) / 24)),
    estimatedHours: Math.max(course.estimatedHours, Math.ceil((course.starterLessons.length + extraLessons.length) * 8 / 60)),
    description: course.description,
    color: course.color,
    icon: course.icon,
    starterLessons: [...course.starterLessons, ...extraLessons],
    curriculumVersion: course.curriculumVersion + 1,
  });
}

export const courses = [...webCourses, ...devCourses, ...botCourses].map((course) => extendCourse(course));

export const practiceTemplates = {
  'HTML/CSS': '<main class="card">\n  <h1>NexCode</h1>\n  <p>J’apprends à construire.</p>\n</main>\n\n<style>\n  .card {\n    max-width: 32rem;\n    padding: 1.5rem;\n    border-radius: 1rem;\n  }\n</style>',
  JavaScript: 'const lessons = ["HTML", "CSS", "JavaScript"];\n\nfor (const lesson of lessons) {\n  console.log(`À apprendre : ${lesson}`);\n}',
  Python: 'def progress(done, total):\n    return round(done / total * 100)\n\nprint(progress(7, 10))',
  SQL: 'SELECT authors.name, COUNT(books.id) AS total_books\nFROM authors\nJOIN books ON books.author_id = authors.id\nGROUP BY authors.id, authors.name\nORDER BY total_books DESC;',
};
