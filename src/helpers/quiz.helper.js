import { readQuizData } from './read.helper.js';

export async function findQuizById(quizId) {
    const quizData = await readQuizData();
    for (const userQuizzes of Object.values(quizData)) {
        const quiz = userQuizzes.find(q => q.id === quizId);
        if (quiz) return quiz;
    }
    return null;
}

export function validateQuiz(quiz) {
    return quiz && 
           Array.isArray(quiz.questions) && 
           quiz.questions.length > 0 &&
           quiz.timeLimit > 0;
}
