import { Quiz } from '../models/Quiz.js';

// Cache for quiz data
const messageCache = new Map();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export async function readQuizData() {
    try {
        if (messageCache.has('quizData')) {
            return messageCache.get('quizData');
        }

        const quizzes = await Quiz.find({}, { _id: 0 }); // Exclude _id field
        const groupedQuizzes = quizzes.reduce((acc, quiz) => {
            if (!acc[quiz.creator]) {
                acc[quiz.creator] = [];
            }
            acc[quiz.creator].push(quiz);
            return acc;
        }, {});

        messageCache.set('quizData', groupedQuizzes);
        
        // Clear cache after timeout
        setTimeout(() => {
            messageCache.delete('quizData');
        }, CACHE_TIMEOUT);
        
        return groupedQuizzes;
    } catch (error) {
        console.error('Error reading quiz data:', error);
        return {};
    }
}

export async function saveQuizData(data) {
    try {
        messageCache.set('quizData', data);
        
        // First, delete all existing documents
        await Quiz.deleteMany({});
        
        // Convert and clean the data
        const quizzes = Object.entries(data).flatMap(([creator, userQuizzes]) => 
            userQuizzes.map(quiz => {
                // Create a clean object without _id
                const cleanQuiz = {
                    id: quiz.id,
                    creator: Number(creator),
                    title: quiz.title,
                    description: quiz.description,
                    questions: quiz.questions,
                    mixing: quiz.mixing,
                    timeLimit: quiz.timeLimit,
                    leaderboard: quiz.leaderboard || []
                };
                return cleanQuiz;
            })
        );

        // Insert all documents as new
        if (quizzes.length > 0) {
            await Quiz.insertMany(quizzes);
        }
    } catch (error) {
        console.error('Error in saveQuizData:', error);
        throw error;
    }
}