import { readQuizData, saveQuizData } from '../helpers/read.helper.js';
import { findQuizById } from '../helpers/quiz.helper.js';

export async function updateLeaderboard(quiz, userEntry) {
    try {
        if (!quiz.leaderboard) {
            quiz.leaderboard = [];
        }

        const leaderboardEntry = {
            chatId: userEntry.chatId,
            username: userEntry.username || '',
            firstName: userEntry.firstName || '',
            lastName: userEntry.lastName || '',
            correctAnswers: userEntry.correctAnswers || 0,
            wrongAnswers: userEntry.wrongAnswers || 0,
            skippedQuestions: userEntry.skippedQuestions || 0,
            timestamp: new Date()
        };

        const existingEntryIndex = quiz.leaderboard.findIndex(entry => entry.chatId === userEntry.chatId);
                
        // Only add new entry if user hasn't taken the test before
        if (existingEntryIndex === -1) {
            quiz.leaderboard.push(leaderboardEntry);

            // Save updated quiz data
            const quizData = await readQuizData();
            for (const userQuizzes of Object.values(quizData)) {
                const quizIndex = userQuizzes.findIndex(q => q.id === quiz.id);
                if (quizIndex !== -1) {
                    userQuizzes[quizIndex] = quiz;
                    await saveQuizData(quizData);
                    break;
                }
            }
        }

        // Calculate position
        const sortedLeaderboard = [...quiz.leaderboard].sort((a, b) => 
            b.correctAnswers - a.correctAnswers || 
            a.timestamp - b.timestamp
        );
        
        return sortedLeaderboard.findIndex(entry => entry.chatId === userEntry.chatId) + 1;
    } catch (error) {
        console.error('Update leaderboard error:', error);
        throw error;
    }
}

export async function showLeaderboard(bot, chatId, quizId) {
    try {
        const quiz = await findQuizById(quizId);
        
        if (!quiz || !quiz.leaderboard) {
            await bot.sendMessage(chatId, "No leaderboard data available.");
            return;
        }

        const sortedLeaderboard = [...quiz.leaderboard]
            .sort((a, b) => b.correctAnswers - a.correctAnswers)
            .slice(0, 10);

        let leaderboardText = `🏆 "${quiz.title}" testi natijalari\n\n`;
        sortedLeaderboard.forEach((entry, index) => {
            const name = entry.username || `${entry.firstName} ${entry.lastName}`.trim() || 'Anonymous';
            leaderboardText += `${index + 1}. ${name} - ✅ ${entry.correctAnswers} to'g'ri\n`;
        });

        await bot.sendMessage(chatId, leaderboardText, {
            reply_markup: {
                inline_keyboard: [[{ text: 'Testga qaytish', callback_data: `start_${quizId}` }]]
            }
        });
    } catch (error) {
        console.error('Show leaderboard error:', error);
        await bot.sendMessage(chatId, "Natijalarni ko'rishda xatolik yuz berdi.");
    }
}
