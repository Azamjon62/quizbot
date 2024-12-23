import { activeQuizSessions, activeGroupQuizSessions } from '../bot.js';
import { findQuizById } from '../helpers/quiz.helper.js';
import { updateLeaderboard } from './leaderboard.service.js';

export async function startQuiz(bot, chatId, quizId, user, isRetake = false) {
    try {
        const quiz = await findQuizById(quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        if (!isRetake) {
            const existingResult = quiz.leaderboard?.find(entry => entry.chatId === chatId);
            
            if (existingResult) {
                const position = quiz.leaderboard
                    .sort((a, b) => b.correctAnswers - a.correctAnswers)
                    .findIndex(entry => entry.chatId === chatId) + 1;

                const message = `🎲 "<b>${quiz.title}</b>" testi\n\n` +
                    `<i>Siz bu testni avval topshirgansiz.</i>\n` +
                    `<i>Sizning natijangiz:</i>\n\n` +
                    `✅ To'g'ri – <b>${existingResult.correctAnswers}</b>\n` +
                    `❌ Noto'g'ri – <b>${existingResult.wrongAnswers}</b>\n` +
                    `⌛️ O'tkazib yuborilgan – <b>${existingResult.skippedQuestions}</b>\n\n` +
                    `${quiz.leaderboard.length} tadan <b>${position}</b>-o'rin.\n\n` +
                    `<i>Siz bu testni qayta topshirishingiz mumkin, lekin bu avvalgi natijangizni o'zgartirmaydi.</i>`;

                const botInfo = await bot.getMe();
                await bot.sendMessage(chatId, message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "Qayta topshirish", callback_data: `retake_${quizId}` }],
                            [{ text: "Guruhda testni boshlash", url: `https://t.me/${botInfo.username}?startgroup=${quizId}` }],
                            [{ text: "Testni ulashish", switch_inline_query: `${quizId}` }]
                        ]
                    },
                    parse_mode: 'HTML'
                });
                return;
            }
        }

        // If user hasn't taken the test, proceed with starting it
        if (activeQuizSessions.has(chatId)) {
            await bot.sendMessage(chatId, 
                "Siz hozir testlardan birini yechyapsiz. Avval uni tugatishingiz kerak. yoki to'xtatish uchun /stop buyrug'ini yuboring.");
            return;
        }

        activeQuizSessions.set(chatId, {
            quizId,
            currentQuestion: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            skippedAnswers: 0,
            user: {
                chatId: user.id,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name
            }
        });

        await bot.sendMessage(chatId, 
            `🎲 "<b>${quiz.title}</b>" Testiga tayyorlaning\n\n` +
            `🖊 ${quiz.questions.length} ta savol\n` +
            `⏱ Har bir savol uchun ${quiz.timeLimit} soniya\n` +
            `📰 Ovozlar test egasiga ko'rinadigan bo'ladi\n\n` +
            `🏁 Tayyor bo'lganingizda quyidagi tugmani bosing.\n` +
            `Uni to'xtatish uchun /stop buyrug'ini yuboring.`, {
            reply_markup: {
                inline_keyboard: [[
                    { text: "Tayyorman", callback_data: `ready_${quizId}` }
                ]]
            },
            parse_mode: 'HTML'
        });

    } catch (error) {
        console.error('Start quiz error:', error);
        await bot.sendMessage(chatId, "Testni boshlashda xatolik yuz berdi.");
    }
}

export async function showQuizResults(bot, chatId, session) {
    try {
        const quiz = await findQuizById(session.quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Quiz not found.");
            return;
        }

        const botDetails = await bot.getMe();
        const totalQuestions = quiz.questions.length;
        const correctAnswers = session.score || 0;
        const answeredQuestions = session.answeredQuestions || 0;
        const wrongAnswers = answeredQuestions - correctAnswers;
        const skippedQuestions = session.skippedAnswers || (totalQuestions - answeredQuestions);

        const position = await updateLeaderboard(quiz, {
            chatId,
            username: session.user.username,
            firstName: session.user.firstName,
            lastName: session.user.lastName,
            correctAnswers,
            wrongAnswers,
            skippedQuestions
        });

        await bot.sendMessage(chatId, 
            `🏁 "${quiz.title}" test yakunlandi!\n\n` +
            `Siz ${answeredQuestions} ta savolga javob berdingiz:\n\n` +
            `✅ To'g'ri – ${correctAnswers}\n` +
            `❌ Xato – ${wrongAnswers}\n` +
            `⌛️ Tashlab ketilgan – ${skippedQuestions}\n\n` +
            `${quiz.leaderboard.length} tadan / ${position}-o'rin.\n\n` +
            `<i>Bu testda yana qatnashishingiz mumkin, lekin bu yetakchilardagi oʻrningizni oʻzgartirmaydi.</i>`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Qayta urinish', callback_data: `retake_${quiz.id}` }],
                    [{ text: 'Guruhda testni boshlash', url: `https://t.me/${botDetails.username}?startgroup=${quiz.id}` }],
                    [{ text: 'Tetsni ulashish', switch_inline_query: `${quiz.id}` }]
                ]
            },
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Show results error:', error);
        await bot.sendMessage(chatId, "An error occurred while showing the results.");
    }
}

export async function startGroupQuiz(bot, chatId, quizId) {
    try {
        if (!bot || !chatId || !quizId) {
            throw new Error('Missing required parameters');
        }

        const quiz = await findQuizById(quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        let session = activeGroupQuizSessions.get(chatId);
        if (!session) {
            session = {
                quizId,
                currentQuestion: 0,
                readyUsers: new Set(),
                participants: new Map(),
                answers: new Map(),
                started: false,
                startMessageId: null
            };
            activeGroupQuizSessions.set(chatId, session);
        }

        const message = `🎲 "${quiz.title}"\n\n` +
            `${quiz.description ? quiz.description + '\n\n' : ''}` +
            `🖊 ${quiz.questions.length} ta savol\n` +
            `⏱ Har bir savol uchun ${quiz.timeLimit} soniya\n` +
            `📰 Natijalar guruh a'zolari va test egasiga ko'rinadi\n\n` +
            `🏁 Test kamida 2 kishi tayyor bo'lganda boshlanadi. To'xtatish uchun /stop buyrug'ini yuboring.`;

        const sentMessage = await bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [[{ text: "Tayyorman", callback_data: `group_ready_${quizId}` }]]
            }
        });

        session.startMessageId = sentMessage.message_id;
    } catch (error) {
        console.error('Start group quiz error:', error);
        await bot.sendMessage(chatId, "Testni boshlashda xatolik yuz berdi.");
    }
}

export async function showGroupQuizResults(bot, chatId, session, quiz) {
    try {
        // Sort participants by correct answers
        const sortedParticipants = [...session.participants.values()]
            .sort((a, b) => b.correctAnswers - a.correctAnswers);

        // Update leaderboard for each participant
        for (const participant of sortedParticipants) {
            const skippedQuestions = quiz.questions.length - 
                (participant.correctAnswers + participant.wrongAnswers);

            await updateLeaderboard(quiz, {
                chatId: participant.userId,
                username: participant.username,
                firstName: participant.firstName,
                lastName: participant.lastName,
                correctAnswers: participant.correctAnswers,
                wrongAnswers: participant.wrongAnswers,
                skippedQuestions: skippedQuestions
            });
        }

        // Create result message
        let resultMessage = `🏁 "${quiz.title}" test yakunlandi!\n\n` +
            `${quiz.questions.length} ta savolga javoblar\n\n`;

        sortedParticipants.forEach((participant, index) => {
            const medal = index === 0 ? '🥇' : 
                        index === 1 ? '🥈' : 
                        index === 2 ? '🥉' : 
                        `${index + 1}.`;
            const username = participant.username ? 
                `@${participant.username}` : 
                participant.firstName;
            resultMessage += `${medal} ${username} – <b>${participant.correctAnswers}</b> ta to'g'ri\n`;
        });

        if (sortedParticipants.length > 0) {
            resultMessage += `\n🏆 G'oliblarni tabriklaymiz!`;
        } else {
            resultMessage += `\nHech kim testda qatnashmadi.`;
        }

        await bot.sendMessage(chatId, resultMessage, {parse_mode: 'HTML'});

    } catch (error) {
        console.error('Show group results error:', error);
        await bot.sendMessage(chatId, "Natijalarni ko'rsatishda xatolik yuz berdi.");
    }
}
