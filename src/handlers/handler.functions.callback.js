import { readQuizData, saveQuizData } from "../helpers/read.helper.js";
import { activeQuizCreation, activeQuizSessions, activeGroupQuizSessions } from '../bot.js';
import { startQuiz } from "../services/quiz.service.js";
import { sendQuizQuestion, sendGroupQuizQuestion } from "./poll.handler.js";


export async function handleViewTests(chatId, bot) {
    const quizData = await readQuizData();
    const userQuizzes = quizData[chatId] || [];

    if (userQuizzes.length === 0) {
        await bot.sendMessage(chatId, "Siz hali test yaratmagansiz.");
        return;
    }

    let message = "<b>Testlaringiz</b>\n\n";
    userQuizzes.forEach((quiz, index) => {
        const totalParticipants = quiz.leaderboard ? quiz.leaderboard.length : 0;
        message += `${index + 1}. <b>${quiz.title}</b> - ${totalParticipants} kishi javob berdi\n`;
        message += `/view_${quiz.id}\n\n`;
    });

    await bot.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: [[{ text: 'Create new test', callback_data: 'create_test' }]]
        },
        parse_mode: 'HTML'
    });
}

export async function handleCreateTest(chatId, bot) {
    activeQuizCreation.set(chatId, { step: 'title' });
    await bot.sendMessage(chatId, 
        "Keling, yangi test tuzamiz. Dastlab, menga testingiz sarlavhasini (masalan, “Qobiliyatni aniqlash testi” yoki “Ayiqlar haqida 10 ta savol”) yuboring.");
}

export async function handleStartQuiz(bot, chatId, quizId, user ) {
    await startQuiz(bot, chatId, quizId, user)
}

export async function handleReady(bot, chatId, quizId) {
    const session = activeQuizSessions.get(chatId);

    if (!session || session.quizId !== quizId) {
        await bot.sendMessage(chatId, "Aktiv quiz topilmadi qayta urinib ko'ring");
        return;
    }

    const countdownMsg = await bot.sendMessage(chatId, "3️⃣...");
    
    setTimeout(async () => {
        await bot.editMessageText("2️⃣ TAYYORMISIZ?", {
            chat_id: chatId,
            message_id: countdownMsg.message_id
        });
        setTimeout(async () => {
            await bot.editMessageText("1️⃣ SOZLANMOQDA", {
                chat_id: chatId,
                message_id: countdownMsg.message_id
            });
            setTimeout(async () => {
                await bot.editMessageText("🚀 KETDIK!", {
                    chat_id: chatId,
                    message_id: countdownMsg.message_id
                })
                await bot.deleteMessage(chatId, countdownMsg.message_id);
                await sendQuizQuestion(bot, chatId);
            }, 800);
        }, 800);
    }, 800);
}

export async function handleGroupReady(bot, chatId, quizId, user) {
    const session = activeGroupQuizSessions.get(chatId);

    if (!session || session.quizId !== quizId) {
        await bot.sendMessage(chatId, "Faol test sessiyasi topilmadi.");
        return;
    }

    session.readyUsers.add(user.id);
    
    if (session.readyUsers.size >= 2 && !session.started) {
        session.started = true;
        await bot.sendMessage(chatId, "Test boshlanmoqda...");
        setTimeout(async () => {
            await sendGroupQuizQuestion(bot, chatId);
        }, 1000);
    }
}

export async function handleStatistics(bot, chatId, quizId, messageId) {
    try {
        const quizData = await readQuizData();
        let quiz = null;

        for (const userQuizzes of Object.values(quizData)) {
            const foundQuiz = userQuizzes.find(q => q.id === quizId);
            if (foundQuiz) {
                quiz = foundQuiz;
                break;
            }
        }

        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        const participantsCount = quiz.leaderboard?.length || 0;
        let message = `🏆 "${quiz.title}" testidagi yuqori natijalar\n\n` +
            `🖊 <b>${quiz.questions.length}</b> ta savol\n` +
            `⏱ Har bir savol uchun ${quiz.timeLimit} soniya\n` +
            `🤓 <b>${participantsCount}</b> kishi testda qatnashdi`

            if (participantsCount) {
                message += `\n\n${quiz.leaderboard?.map((user, index) => `${index + 1}. ${user.username ? `@${user.username}` : `${user.firstName ? user.firstName : ''} ${user.lastName ? user.lastName : ''}`.trim() || 'Anonymous'} - <b>${user.correctAnswers}</b> ta to'g'ri javob`).join('\n')}`;
            } else {
                message += ''
            }
            

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "<< Testga qaytish", callback_data: `return_${quizId}` }]
                ]
            },
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Statistics error:', error);
        await bot.sendMessage(chatId, "Statistikani ko'rishda xatolik yuz berdi.");
    }
}

export async function handleReturn(bot, chatId, quizId, messageId) {
    try {
        const quizData = await readQuizData();
        let quiz = null;

        // Find the quiz
        for (const userQuizzes of Object.values(quizData)) {
            const foundQuiz = userQuizzes.find(q => q.id === quizId);
            if (foundQuiz) {
                quiz = foundQuiz;
                break;
            }
        }

        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        const botDetails = await bot.getMe();
        const shareLink = `t.me/${botDetails.username}?start=${quizId}`;
        const message = `<b>${quiz.title}</b> <i>${quiz.leaderboard?.length || 0} kishi javob berdi.</i>\n${quiz.description}\n🖊 ${quiz.questions.length} ta savol · ⏱ ${quiz.timeLimit} soniya\n\n<b>External sharing link:</b>\n${shareLink}`;

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Bu testni boshlash', callback_data: `start_${quizId}` }],
                    [{ text: 'Guruhda testni boshlash', url: `https://t.me/${botDetails.username}?startgroup=${quizId}` }],
                    [{ text: 'Testni ulashish', switch_inline_query: `${quizId}` }],
                    [{ text: 'Testni tahrirlash', callback_data: `edit_${quizId}` }],
                    [{ text: 'Test statistikasi', callback_data: `stats_${quizId}` }]
                ]
            }
        });
    } catch (error) {
        console.error('Return to test error:', error);
        await bot.sendMessage(chatId, "Testga qaytishda xatolik yuz berdi.");
    }
}

export async function handleEdit(bot, chatId, quizId, messageId) {
    try {
        const quizData = await readQuizData();
        let quiz = null;

        for (const userQuizzes of Object.values(quizData)) {
            const foundQuiz = userQuizzes.find(q => q.id === quizId);
            if (foundQuiz) {
                quiz = foundQuiz;
                break;
            }
        }

        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        const botDetails = await bot.getMe();
        const shareLink = `t.me/${botDetails.username}?start=${quizId}`;
        const message = `<b>${quiz.title}</b> <i>${quiz.leaderboard?.length || 0} kishi javob berdi.</i>\n${quiz.description}\n🖊 ${quiz.questions.length} ta savol · ⏱ ${quiz.timeLimit} soniya\n\n<b>External sharing link:</b>\n${shareLink}`;

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Testni o'chirish", callback_data: `deleteTest_${quizId}` }],
                    // [{ text: 'Savollarni tahrirlash', callback_data: `editQuestions_${quizId}` }],
                    // [{ text: 'Sarlavhani tahrirlash', callback_data: `editTitle_${quizId}` }],
                    // [{ text: 'Tavsifni tahrirlash', callback_data: `editDescription_${quizId}` }],
                    // [{ text: 'Taymerni sozlamalarini tahrirlash', callback_data: `editTimer_${quizId}` }],
                    [{ text: "<< Orqaga qaytish", callback_data: `return_${quizId}` }]
                ]
            }
        });
        
    } catch (error) {
        console.error('Editing error:', error);
        await bot.sendMessage(chatId, "Tahrirlashda xatolik yuz berdi.");
    }
}

export async function handleDeleteTest(bot, chatId, quizId, messageId) {
    try {
        const quizData = await readQuizData();
        const quiz = quizData[chatId].find(q => q.id === quizId);

        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        quizData[chatId] = quizData[chatId].filter(q => q.id !== quizId);
        await saveQuizData(quizData);

        await bot.deleteMessage(chatId, messageId)
        await bot.sendMessage(chatId, "Test o'chirildi.");
    } catch (error) {
        console.error('Deleting test error:', error);
        await bot.sendMessage(chatId, "Test o'chirishda xatolik yuz berdi.");
    }
}

export async function handleEditQuestion(bot, chatId, quizId, messageId) {
    try {
        const quizData = await readQuizData();
        const quiz = quizData[chatId].find(q => q.id === quizId);

        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }
        
        let message = `🎲 '<b>${quiz.title}</b>' testi \n` +
            `🖊 ${quiz.questions.length} ta savol\n\n`

        
        let i = 1;
        for (const question of quiz.questions) {
            message += `${i}. ${question.question}\n`;
            message += `/view_${quizId}_${i}\n\n`;
            i++;
        }
        
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Yangi savol qo'shish", callback_data: `create_test` }],
                    [{ text: "<< Orqaga qaytish", callback_data: `return_${quizId}` }]
                ]
            },
            parse_mode: 'HTML'
        });
        
    } catch (error) {
        console.error('Editing questions error:', error);
        await bot.sendMessage(chatId, "Savollarni tahrirlashda xatolik yuz berdi.");
    }
}