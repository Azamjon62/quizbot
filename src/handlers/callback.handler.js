import { startQuiz } from '../services/quiz.service.js';
import { showLeaderboard } from '../services/leaderboard.service.js';
import { activeQuizCreation, activeQuizSessions, activeGroupQuizSessions } from '../bot.js';
import { sendQuizQuestion, sendGroupQuizQuestion } from './poll.handler.js';
import { readQuizData } from '../helpers/read.helper.js';

export function setupCallbackHandlers(bot) {
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        const user = callbackQuery.from;

        try {
            if (data === 'view_tests') {                
                const quizData = await readQuizData();
                const userQuizzes = quizData[chatId] || [];

                if (userQuizzes.length === 0) {
                    await bot.sendMessage(chatId, "You haven't created any tests yet.");
                    return;
                }

                let message = "<b>Testlaringiz</b>\n\n";
                userQuizzes.forEach((quiz, index) => {
                    const totalParticipants = quiz.leaderboard ? quiz.leaderboard.length : 0;
                    message += `${index + 1}. <b>${quiz.title}</b> <i>${totalParticipants} kishi javob berdi</i>\n`;
                    message += `<i>🖊 ${quiz.questions.length} ta savol · ⏱ ${quiz.timeLimit} soniya</i>\n`;
                    message += `/view_${quiz.id}\n\n`;
                });

                await bot.sendMessage(chatId, message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Create new test', callback_data: 'create_test' }]
                        ]
                    },
                    parse_mode: 'HTML' 
                });
            }
            else if (data === 'create_test') {
                activeQuizCreation.set(chatId, { step: 'title' });
                await bot.sendMessage(chatId, 
                    "Keling, yangi test tuzamiz. Dastlab, menga testingiz sarlavhasini (masalan, “Qobiliyatni aniqlash testi” yoki “Ayiqlar haqida 10 ta savol”) yuboring.");
            }
            else if (data.startsWith('start_')) {
                const quizId = data.split('start_')[1];
                await startQuiz(bot, chatId, quizId, user);
            }
            else if (data.startsWith('ready_')) {
                const quizId = data.split('ready_')[1];
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
                        await bot.editMessageText("🚀 KETDIK!", {
                            chat_id: chatId,
                            message_id: countdownMsg.message_id
                        });
                        setTimeout(async () => {
                            await bot.deleteMessage(chatId, countdownMsg.message_id);
                            await sendQuizQuestion(bot, chatId);
                        }, 1000);
                    }, 1000);
                }, 1000);
            }
            else if (data.startsWith('leaderboard_')) {
                const quizId = data.split('leaderboard_')[1];
                await showLeaderboard(bot, chatId, quizId);
            }
            else if (data.startsWith('retake_')) {
                const quizId = data.split('retake_')[1];
                await startQuiz(bot, chatId, quizId, user, true);
            }
            else if (data.startsWith('share_')) {
                const botDetails = await bot.getMe();
                const quizId = data.split('share_')[1];

                const shareLink = `t.me/${botDetails.username}?start=${quizId}`;
                await bot.sendMessage(chatId, `Share this link to invite others:\n${shareLink}`);

            } else if (data.startsWith('group_ready_')) {
                const quizId = data.split('group_ready_')[1];
                const session = activeGroupQuizSessions.get(chatId);

                if (!session || session.quizId !== quizId) {
                    await bot.sendMessage(chatId, "Faol test sessiyasi topilmadi.");
                    return;
                }

                session.readyUsers.add(user.id);
                
                if (session.readyUsers.size >= 1 && !session.started) {
                    session.started = true;
                    await bot.sendMessage(chatId, "Test boshlanmoqda...");
                    setTimeout(async () => {
                        await sendGroupQuizQuestion(bot, chatId);
                    }, 2000);
                } else if (!session.started) {
                    await bot.sendMessage(chatId, 
                        `${session.readyUsers.size} kishi tayyor. Kamida 2 kishi tayyor bo'lishi kerak.`);
                }
            } else if (data.startsWith('answer_')) {
                const [_, questionIndex, answerIndex] = data.split('_').map(Number);
                const session = activeGroupQuizSessions.get(chatId);
                console.log('b', session);
                

                if (!session || !session.isGroupQuiz) return;

                const quiz = await findQuizById(session.quizId);
                const question = quiz.questions[questionIndex];

                if (!question) return;

                let participant = session.participants.get(user.id);
                if (!participant) {
                    participant = {
                        userId: user.id,
                        username: user.username,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        correctAnswers: 0,
                        wrongAnswers: 0,
                        answers: new Set()
                    };
                    session.participants.set(user.id, participant);
                }

                // Only count first answer for each question
                if (!participant.answers.has(questionIndex)) {
                    participant.answers.add(questionIndex);
                    
                    if (Number(answerIndex) === question.correctAnswer) {
                        participant.correctAnswers++;
                    } else {
                        participant.wrongAnswers++;
                    }
                }

                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: "Javobingiz qabul qilindi!"
                });
            } else if (data.startsWith('stats_')) {
                const quizId = data.split('stats_')[1];
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
                    const message = `🏆 "${quiz.title}" testidagi yuqori natijalar\n\n` +
                        `🖊 ${quiz.questions.length} ta savol\n` +
                        `⏱ Har bir savol uchun ${quiz.timeLimit} soniya\n` +
                        `🤓 ${participantsCount} kishi testda qatnashdi` +
                        `\n\n${quiz.leaderboard?.map((user, index) => `${index + 1}. ${user.username ? `@${user.username}` : `${user.firstName ? user.firstName : ''} ${user.lastName ? user.lastName : ''}`.trim() || 'Anonymous'} - <b>${user.correctAnswers}</b> ta to'g'ri javob`).join('\n')}`;

                    await bot.editMessageText(message, {
                        chat_id: chatId,
                        message_id: callbackQuery.message.message_id,
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
            } else if (data.startsWith('return_')) {
                const quizId = data.split('return_')[1];

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
                        message_id: callbackQuery.message.message_id,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Bu testni boshlash', callback_data: `start_${quizId}` }],
                                [{ text: 'Guruhda testni boshlash', url: `https://t.me/${botDetails.username}?startgroup=${quizId}&admin=can_post_messages%2Ccan_manage_topics%2Ccan_delete_messages` }],
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
        } catch (error) {
            console.error('Callback query error:', error);
            await bot.sendMessage(chatId, "An error occurred. Please try again.");
        }
    });

    // Handle when bot is added to a group
    bot.on('message', async (msg) => {
        // Check if this is a group chat and contains the start command with parameters
        if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
            const text = msg.text || '';
            const match = text.match(/^\/start(group)?\s+(.+)/);
            
            if (match) {
                const quizId = match[2];
                
                // Check if bot has required admin rights
                const botMember = await bot.getChatMember(msg.chat.id, (await bot.getMe()).id);
                
                if (!botMember.can_post_messages || !botMember.can_delete_messages) {
                    await bot.sendMessage(msg.chat.id, 
                        "Bot guruhda test o'tkazish uchun quyidagi huquqlarga ega bo'lishi kerak:\n\n" +
                        "• Xabarlarni yuborish\n" +
                        "• Xabarlarni o'chirish\n\n" +
                        "Iltimos, botga admin huquqlarini bering va qaytadan urinib ko'ring.");
                    return;
                }

                // Start the quiz in the group
                await startQuiz(bot, msg.chat.id, quizId, msg.from);
            }
        }
    });
}
