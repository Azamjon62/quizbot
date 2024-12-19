import { Quiz } from '../models/Quiz.js';

export async function findQuizById(quizId) {
    try {
        return await Quiz.findOne({ id: quizId });
    } catch (error) {
        console.error('Error finding quiz:', error);
        return null;
    }
}

export function validateQuiz(quiz) {
    return quiz && 
           Array.isArray(quiz.questions) && 
           quiz.questions.length > 0 &&
           quiz.timeLimit > 0;
}

export async function findAllQuizzesByUserId(userId) {
    return await Quiz.find({ creator: userId });
}