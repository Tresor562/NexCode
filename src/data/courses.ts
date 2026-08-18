import { botCourses } from './coursesBots';
import { devCourses } from './coursesDev';
import { webCourses } from './coursesWeb';
import { guidedProjects } from './projects';

export type { Course, CourseCategory, GuidedProject, Lesson } from './curriculumCore';
export { guidedProjects };

export const courses = [...webCourses, ...devCourses, ...botCourses];

export const practiceTemplates = {
  'HTML/CSS': '<main class="card">\n  <h1>NexCode</h1>\n  <p>J’apprends à construire.</p>\n</main>\n\n<style>\n  .card {\n    max-width: 32rem;\n    padding: 1.5rem;\n    border-radius: 1rem;\n  }\n</style>',
  JavaScript: 'const lessons = ["HTML", "CSS", "JavaScript"];\n\nfor (const lesson of lessons) {\n  console.log(`À apprendre : ${lesson}`);\n}',
  Python: 'def progress(done, total):\n    return round(done / total * 100)\n\nprint(progress(7, 10))',
  SQL: 'SELECT authors.name, COUNT(books.id) AS total_books\nFROM authors\nJOIN books ON books.author_id = authors.id\nGROUP BY authors.id, authors.name\nORDER BY total_books DESC;',
};
