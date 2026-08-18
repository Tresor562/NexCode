import { botCourses } from './coursesBots';
import { devCourses } from './coursesDev';
import { webCourses } from './coursesWeb';
import { webInternetMasteryLessons } from './webInternetMastery';
import { htmlMasteryLessons } from './htmlMastery';
import { cssMasteryLessons } from './cssMastery';
import { javascriptMasteryLessons } from './javascriptMastery';
import { pythonMasteryLessons } from './pythonMastery';
import { sqlMasteryLessons } from './sqlMastery';
import { gitMasteryLessons } from './gitMastery';
import { nodeApiMasteryLessons } from './nodeApiMastery';
import { webIntegrationMasteryLessons, htmlIntegrationMasteryLessons, cssIntegrationMasteryLessons } from './frontendIntegrationMastery';
import { guidedProjects } from './projects';
import { Course, Lesson, makeCourse } from './curriculumCore';

export type { Course, CourseCategory, GuidedProject, Lesson } from './curriculumCore';
export { guidedProjects };

function expansionFor(courseId: string): Lesson[] {
  if (courseId === 'web-internet-foundations') return [...webInternetMasteryLessons, ...webIntegrationMasteryLessons];
  if (courseId === 'html-foundations') return [...htmlMasteryLessons, ...htmlIntegrationMasteryLessons];
  if (courseId === 'css-foundations') return [...cssMasteryLessons, ...cssIntegrationMasteryLessons];
  if (courseId === 'javascript-foundations') return javascriptMasteryLessons;
  if (courseId === 'python-foundations') return pythonMasteryLessons;
  if (courseId === 'sql-foundations') return sqlMasteryLessons;
  if (courseId === 'git-github-foundations') return gitMasteryLessons;
  if (courseId === 'node-api-foundations') return nodeApiMasteryLessons;
  return [];
}

function extendCourse(course: Course) {
  const extraLessons = expansionFor(course.id);
  if (extraLessons.length === 0) return course;
  const totalLessons = course.starterLessons.length + extraLessons.length;
  return makeCourse({
    id: course.id,
    title: course.title,
    language: course.language,
    category: course.category,
    level: course.level,
    offlineSizeMb: Math.max(course.offlineSizeMb, Math.ceil(totalLessons / 24)),
    estimatedHours: Math.max(course.estimatedHours, Math.ceil(totalLessons * 8 / 60)),
    description: course.description,
    color: course.color,
    icon: course.icon,
    starterLessons: [...course.starterLessons, ...extraLessons],
    curriculumVersion: course.curriculumVersion + 1,
  });
}

export const courses = [...webCourses, ...devCourses, ...botCourses].map(extendCourse);

export const practiceTemplates = {
  'HTML/CSS': '<main class="card">\n  <h1>NexCode</h1>\n  <p>J’apprends à construire.</p>\n</main>\n\n<style>\n  .card {\n    max-width: 32rem;\n    padding: 1.5rem;\n    border-radius: 1rem;\n  }\n</style>',
  JavaScript: 'const lessons = ["HTML", "CSS", "JavaScript"];\n\nfor (const lesson of lessons) {\n  console.log(`À apprendre : ${lesson}`);\n}',
  Python: 'def progress(done, total):\n    return round(done / total * 100)\n\nprint(progress(7, 10))',
  SQL: 'SELECT authors.name, COUNT(books.id) AS total_books\nFROM authors\nJOIN books ON books.author_id = authors.id\nGROUP BY authors.id, authors.name\nORDER BY total_books DESC;',
};
