import { startQuiz, startGroupQuiz } from '../services/quiz.service.js';
import { activeQuizCreation, activeQuizSessions } from '../bot.js';
import { readQuizData } from '../helpers/read.helper.js';
                           // AZ          AS         DO
const ALLOWED_USER_IDS = [5947470966, 578038920, 892690776];
export function setupCommandHandlers(bot) {
    // Handler for all commands (messages starting with /)
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!ALLOWED_USER_IDS.includes(userId)) {
            await bot.sendMessage(chatId, "❌ Kechirasiz, siz bu botdan foydalana olmaysiz.");
            return;
        }

        if (!msg.text?.startsWith('/')) return;
        
        const text = msg.text;

        // Check if message is from a group
        if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
            // Allow quiz-related commands in groups
            if (text.startsWith('/start')) {
                const quizId = text.split(' ')[1];
                await startGroupQuiz(bot, chatId, quizId);
                return;
            }

            // For all other commands, redirect to private chat
            const botInfo = await bot.getMe();
            await bot.sendMessage(chatId, 
                "Bu bot sizga bir nechta test savollari bilan test tuzishga yordam beradi. Yangi test yaratish yoki yaratgan testlaringiz ro'yxatini ko'rish uchun bot bilan shaxsiy chatga o'ting.", {
                reply_to_message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "Bot bilan suhbatlashish", url: `https://t.me/${botInfo.username}` }]
                    ]
                }
            });
            return;
        }

        // Handle view command
        if (text.startsWith('/view_')) {
            const quizId = text.substring(6); // Remove '/view_' prefix
            try {
                const quizData = await readQuizData();
                let quiz = null;
                let isCreator = false;

                if (quizData[chatId]) {
                    quiz = quizData[chatId].find(q => q.id === quizId);
                    if (quiz) {
                        isCreator = true;
                    }
                }

                if (!quiz) {
                    await bot.sendMessage(chatId, "Test topilmadi yoki siz bu testning yaratuvchisi emassiz.");
                    return;
                }

                if (isCreator) {
                    const botDetails = await bot.getMe();
                    const shareLink = `t.me/${botDetails.username}?start=${quizId}`;
                    const message = `<b>${quiz.title}</b> <i>${quiz.leaderboard?.length || 0} kishi javob berdi.</i>\n${quiz.description}\n🖊 ${quiz.questions.length} ta savol · ⏱ ${quiz.timeLimit} soniya\n\n<b>External sharing link:</b>\n${shareLink}`;

                    await bot.sendMessage(chatId, message, {
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
                }
            } catch (error) {
                console.error('View command error:', error);
                await bot.sendMessage(chatId, "Test ma'lumotlarini ko'rishda xatolik yuz berdi.");
            }
            return;
        }

        // Handle other commands
        switch (text.split(' ')[0]) {
            case '/start':
                if (text.includes(' ')) {
                    const quizId = text.split(' ')[1];
                    await startQuiz(bot, chatId, quizId, msg.from);
                } else {
                    await bot.sendMessage(chatId, 
                        "Bu bot sizga bir nechta test savollari bilan test tuzishga yordam beradi.", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Yangi test tuzish', callback_data: 'create_test' }],
                                [{ text: "Testlarimni ko'rish", callback_data: 'view_tests' }]
                            ]
                        }
                    });
                }
                break;

            case '/cancel':
                if (activeQuizCreation.has(chatId)) {
                    activeQuizCreation.delete(chatId);
                    await bot.sendMessage(chatId, 
                        "Test bekor qilindi. Yangisini yaratish uchun /start buyrugʻini yuboring.", {
                        reply_markup: {
                            remove_keyboard: true,
                        }
                    });
                } else {
                    await bot.sendMessage(chatId, "🤔 Bekor qilish uchun hech narsa yoʻq..");
                }
                break;

            case '/stop':
                if (activeQuizSessions.has(chatId)) {
                    activeQuizSessions.delete(chatId);
                    await bot.sendMessage(chatId, "Test toxtatildi.");
                } else {
                    await bot.sendMessage(chatId, "🤔 Toʻxtatish uchun test mavjud emas.");
                }
                break;
        }
    });
}