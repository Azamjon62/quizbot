import { readQuizData, saveQuizData } from "../helpers/read.helper.js";
import { findQuizById, findAllQuizzesByUserId } from "../helpers/quiz.helper.js";
import { activeQuizCreation, activeQuizSessions, activeGroupQuizSessions, activeMessageId } from '../bot.js';
import { startQuiz } from "../services/quiz.service.js";
import { sendQuizQuestion, sendGroupQuizQuestion } from "./poll.handler.js";

const QUESTIONS_PER_PAGE = 20;
const TESTS_PER_PAGE = 10;

export async function handleDelete(bot, chatId, messageId) {
    try {
        await bot.deleteMessage(chatId, messageId);
    } catch (error) {
        console.error('Delete test error:', error);
        await bot.sendMessage(chatId, "Test o'chirishda xatolik yuz berdi.");
    }
}

export async function handleEditedTest(bot, chatId, quizId) {
    try {
        const quiz = await findQuizById(quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        const isCreator = quiz.creator === chatId;
        if (!isCreator) {
            await bot.sendMessage(chatId, "Siz bu testning yaratuvchisi emassiz.");
            return;
        }

        const botDetails = await bot.getMe();
        const shareLink = `t.me/${botDetails.username}?start=${quizId}`;
        const message = `<b>${quiz.title}</b> <i>${quiz.leaderboard?.length || 0} kishi javob berdi.</i>\n${quiz.description}\n🖊 ${quiz.questions.length} ta savol · ⏱ ${quiz.timeLimit} soniya · ${quiz.mixing == 'barchasi' ? '🔀' : quiz.mixing == 'aralashtirilmaydi' ? '⏬' : quiz.mixing == 'savollar' ? '🔀' : quiz.mixing == 'javoblar' ? '🔀' : ''} ${quiz.mixing} \n\n<b>External sharing link:</b>\n${shareLink}`;

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
    } catch (error) {
        console.error('View command error:', error);
        await bot.sendMessage(chatId, "Test ma'lumotlarini ko'rishda xatolik yuz berdi.");
    }
}


export async function handleViewTests(chatId, bot, page = 1) {
    try {
        const quizzes = await findAllQuizzesByUserId(chatId);

        if (quizzes.length === 0) {
            await bot.sendMessage(chatId, "Siz hali test yaratmagansiz.");
            return;
        }

        // Calculate pagination
        const totalPages = Math.ceil(quizzes.length / TESTS_PER_PAGE);
        const startIndex = (page - 1) * TESTS_PER_PAGE;
        const endIndex = Math.min(startIndex + TESTS_PER_PAGE, quizzes.length);
        const currentPageQuizzes = quizzes.slice(startIndex, endIndex);

        let message = "<b>Testlaringiz</b>\n";
        message += `📄 Sahifa ${page}/${totalPages}\n`;
        message += `📊 Jami ${quizzes.length} ta test\n\n`;

        currentPageQuizzes.forEach((quiz, index) => {
            const totalParticipants = quiz.leaderboard ? quiz.leaderboard.length : 0;
            message += `${startIndex + index + 1}. <b>${quiz.title}</b> - <b>${totalParticipants}</b> kishi javob berdi\n`;
            message += `/view_${quiz.id}\n\n`;
        });

        // Create inline keyboard with pagination
        const inlineKeyboard = [];

        // Navigation row
        const navigationRow = [];
        if (page > 1) {
            navigationRow.push({ 
                text: "⬅️ Oldingi", 
                callback_data: `viewTests_${page - 1}` 
            });
        }
        if (page < totalPages) {
            navigationRow.push({ 
                text: "Keyingi ➡️", 
                callback_data: `viewTests_${page + 1}` 
            });
        }
        if (navigationRow.length > 0) {
            inlineKeyboard.push(navigationRow);
        }

        // Action button
        inlineKeyboard.push([{ 
            text: 'Yangi test yaratish', 
            callback_data: 'create_test' 
        }]);

        await bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: inlineKeyboard
            },
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('View tests error:', error);
        await bot.sendMessage(chatId, "Testlarni ko'rishda xatolik yuz berdi.");
    }
}

export async function handleViewTestsPages(chatId, bot, messageId, page = 1) {
    try {
        const quizzes = await findAllQuizzesByUserId(chatId);

        if (quizzes.length === 0) {
            await bot.sendMessage(chatId, "Siz hali test yaratmagansiz.");
            return;
        }

        // Calculate pagination
        const totalPages = Math.ceil(quizzes.length / TESTS_PER_PAGE);
        const startIndex = (page - 1) * TESTS_PER_PAGE;
        const endIndex = Math.min(startIndex + TESTS_PER_PAGE, quizzes.length);
        const currentPageQuizzes = quizzes.slice(startIndex, endIndex);

        let message = "<b>Testlaringiz</b>\n";
        message += `📄 Sahifa ${page}/${totalPages}\n`;
        message += `📊 Jami ${quizzes.length} ta test\n\n`;

        currentPageQuizzes.forEach((quiz, index) => {
            const totalParticipants = quiz.leaderboard ? quiz.leaderboard.length : 0;
            message += `${startIndex + index + 1}. <b>${quiz.title}</b> - <b>${totalParticipants}</b> kishi javob berdi\n`;
            message += `/view_${quiz.id}\n\n`;
        });

        // Create inline keyboard with pagination
        const inlineKeyboard = [];

        // Navigation row
        const navigationRow = [];
        if (page > 1) {
            navigationRow.push({ 
                text: "⬅️ Oldingi", 
                callback_data: `viewTests_${page - 1}` 
            });
        }
        if (page < totalPages) {
            navigationRow.push({ 
                text: "Keyingi ➡️", 
                callback_data: `viewTests_${page + 1}` 
            });
        }
        if (navigationRow.length > 0) {
            inlineKeyboard.push(navigationRow);
        }

        // Action button
        inlineKeyboard.push([{ 
            text: 'Yangi test yaratish', 
            callback_data: 'create_test' 
        }]);

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: inlineKeyboard
            },
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('View tests error:', error);
        await bot.sendMessage(chatId, "Testlarni ko'rishda xatolik yuz berdi.");
    }
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

export async function handleGroupReady(bot, chatId, quizId, user, callbackQuery) {
    const session = activeGroupQuizSessions.get(chatId);
    const quiz = await findQuizById(quizId);

    if (!session || session.quizId !== quizId) {
        await bot.sendMessage(chatId, "Faol test sessiyasi topilmadi.");
        return;
    }

    if (session.readyUsers.has(user.id)) {
        bot.answerCallbackQuery(callbackQuery.id, {
            text: "Qoyilmaqom!, Test tez orada boshlanadi."
        });
        return
    } else {
        session.readyUsers.add(user.id);
    }

    let message = `🎲 "${quiz.title}"\n\n` +
        `${quiz.description ? quiz.description + '\n\n' : ''}` +
        `🖊 ${quiz.questions.length} ta savol\n` +
        `⏱ Har bir savol uchun ${quiz.timeLimit} soniya\n` +
        `📰 Natijalar guruh a'zolari va test egasiga ko'rinadi\n\n` +
        `🏁 Test kamida 2 kishi tayyor bo'lganda boshlanadi. To'xtatish uchun /stop buyrug'ini yuboring.`;

    if (session.readyUsers.size == 1) {
        message += `Tayyorlar soni: 1/2`;
    }

    // If this is the first person ready, update the message to show count
    if (session.readyUsers.size === 1) {
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: session.startMessageId,
            reply_markup: {
                inline_keyboard: [[{ text: "Tayyorman", callback_data: `group_ready_${quizId}` }]]
            }
        });
    }
    
    if (session.readyUsers.size >= 2 && !session.started) {
        session.started = true;

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: session.startMessageId
        });

        await bot.sendMessage(chatId, "Test boshlanmoqda...");
        setTimeout(async () => {
            await sendGroupQuizQuestion(bot, chatId);
        }, 1000);
    }
}

export async function handleStatistics(bot, chatId, quizId, messageId) {
    try {
        const quiz = await findQuizById(quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        const participantsCount = quiz.leaderboard?.length || 0;

        const sortedLeaderboard = quiz.leaderboard
            ? [...quiz.leaderboard].sort((a, b) => b.correctAnswers - a.correctAnswers)
            : [];

        let message = `🏆 "${quiz.title}" testidagi yuqori natijalar\n\n` +
            `🖊 <b>${quiz.questions.length}</b> ta savol\n` +
            `⏱ Har bir savol uchun ${quiz.timeLimit} soniya\n` +
            `🤓 <b>${participantsCount}</b> kishi testda qatnashdi`;

        if (participantsCount) {
            message += `\n\n${sortedLeaderboard.map((user, index) => 
                `${index + 1}. ${user.username ? `@${user.username}` : 
                `${user.firstName ? user.firstName : ''} ${user.lastName ? user.lastName : ''}`.trim() || 'Anonymous'} - <b>${user.correctAnswers}</b> ta to'g'ri javob`).join('\n')}`;
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
        const quiz = await findQuizById(quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        const botDetails = await bot.getMe();
        const shareLink = `t.me/${botDetails.username}?start=${quizId}`;
        const message = `<b>${quiz.title}</b> <i>${quiz.leaderboard?.length || 0} kishi javob berdi.</i>\n${quiz.description}\n🖊 ${quiz.questions.length} ta savol · ⏱ ${quiz.timeLimit} soniya · ${quiz.mixing == 'barchasi' ? '🔀' : quiz.mixing == 'aralashtirilmaydi' ? '⏬' : quiz.mixing == 'savollar' ? '🔀' : quiz.mixing == 'javoblar' ? '🔀' : ''} ${quiz.mixing} \n\n<b>External sharing link:</b>\n${shareLink}`;

        try {
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
        } catch (editError) {
            if (editError.message.includes('message is not modified')) {
                return;
            }
            throw editError;
        }
    } catch (error) {
        console.error('Return to test error:', error);
        await bot.sendMessage(chatId, "Testga qaytishda xatolik yuz berdi.");
    }
}

export async function handleEdit(bot, chatId, quizId, messageId) {
    try {
        const quiz = await findQuizById(quizId);

        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        const botDetails = await bot.getMe();
        const shareLink = `t.me/${botDetails.username}?start=${quizId}`;
        const message = `<b>${quiz.title}</b> <i>${quiz.leaderboard?.length || 0} kishi javob berdi.</i>\n${quiz.description}\n🖊 ${quiz.questions.length} ta savol · ⏱ ${quiz.timeLimit} soniya · ${quiz.mixing == 'barchasi' ? '🔀' : quiz.mixing == 'aralashtirilmaydi' ? '⏬' : quiz.mixing == 'savollar' ? '🔀' : quiz.mixing == 'javoblar' ? '🔀' : ''} ${quiz.mixing} \n\n<b>External sharing link:</b>\n${shareLink}`;

        try {
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "Testni o'chirish", callback_data: `deleteTest_${quizId}` }],
                        [{ text: 'Savollarni tahrirlash', callback_data: `editQuestions_${quizId}` }],
                        [{ text: 'Sarlavhani tahrirlash', callback_data: `editTitle_${quizId}` }],
                        [{ text: 'Tavsifni tahrirlash', callback_data: `editDescription_${quizId}` }],
                        [{ text: 'Taymerni sozlamalarini tahrirlash', callback_data: `editTimer_${quizId}` }],
                        [{ text: 'Aralashtirish sozlamalarini tahrirlash', callback_data: `editMixing_${quizId}` }],
                        [{ text: "<< Orqaga qaytish", callback_data: `return_${quizId}` }]
                    ]
                }
            });
            
        } catch (editError) {
            // If message is not modified, ignore the error
            if (editError.message.includes('message is not modified')) {
                return;
            }
            // If other error, throw it
            throw editError;
        }

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

export async function handleEditQuestion(bot, chatId, quizId, messageId, page = 1) {
    try {
        const quizData = await readQuizData();
        const quiz = quizData[chatId].find(q => q.id === quizId);

        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        // Calculate pagination
        const totalPages = Math.ceil(quiz.questions.length / QUESTIONS_PER_PAGE);
        const startIndex = (page - 1) * QUESTIONS_PER_PAGE;
        const endIndex = Math.min(startIndex + QUESTIONS_PER_PAGE, quiz.questions.length);
        
        let message = `🎲 '<b>${quiz.title}</b>' testi \n` +
            `🖊 ${quiz.questions.length} ta savol\n\n` +
            `📄 Sahifa ${page}/${totalPages}\n\n`;

        for (let i = startIndex; i < endIndex; i++) {
            const question = quiz.questions[i];
            message += `${i + 1}. ${question.question}\n`;
            if (quiz.questions.length != 1) {
                message += `/deleteQuestion_${quizId}_${i + 1}\n\n`;
            }
        }

        activeMessageId.set(chatId, messageId);

        const inlineKeyboard = [];

        const navigationRow = [];
        if (page > 1) {
            navigationRow.push({ 
                text: "⬅️ Oldingi", 
                callback_data: `editQuestions_${quizId}_${page - 1}` 
            });
        }
        if (page < totalPages) {
            navigationRow.push({ 
                text: "Keyingi ➡️", 
                callback_data: `editQuestions_${quizId}_${page + 1}` 
            });
        }
        if (navigationRow.length > 0) {
            inlineKeyboard.push(navigationRow);
        }
        
        inlineKeyboard.push([{ 
            text: "Yangi savol qo'shish", 
            callback_data: `createQuestion_${quizId}` 
        }]);
        inlineKeyboard.push([{ 
            text: "<< Orqaga qaytish", 
            callback_data: `return_${quizId}` 
        }]);
        
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: inlineKeyboard
            },
            parse_mode: 'HTML'
        });
        
    } catch (error) {
        console.error('Editing questions error:', error);
        await bot.sendMessage(chatId, "Savollarni tahrirlashda xatolik yuz berdi.");
    }
}

export async function handleEditTitle(bot, chatId, quizId, messageId) {
    try {
        const quiz = await findQuizById(quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        activeQuizCreation.set(chatId, {
            step: 'editTitle',
            quizId: quizId,
            messageId: messageId,
            currentTitle: quiz.title
        });

        await bot.sendMessage(chatId, "O'zgartirish uchun menga testingiz sarlavhasini (masalan, “Qobiliyatni aniqlash testi” yoki “Ayiqlar haqida 10 ta savol”) yuboring. \n\n Bekor qilish uchun /back buyrug'ini yuboring.")        
    } catch (error) {
        console.error('Edit title error:', error);
        await bot.sendMessage(chatId, "Sarlavhani tahrirlashda xatolik yuz berdi.");
    }
}

export async function handleEditDescription(bot, chatId, quizId, messageId) {
    try {
        const quiz = await findQuizById(quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        activeQuizCreation.set(chatId, {
            step: 'editDescription',
            quizId: quizId,
            messageId: messageId,
            currentDescription: quiz.description
        });

        await bot.sendMessage(chatId,
            `Menga testingizning yangi tavsifini yuboring. Bu ixtiyoriy, uni boʻsh qoldirish uchun /skip buyrugʻini yuborishingiz ham mumkin.\n`);

    } catch (error) {
        console.error('Edit description error:', error);
        await bot.sendMessage(chatId, "Tavsifni tahrirlashda xatolik yuz berdi.");
    }
}

export async function handleEditTimer(bot, chatId, quizId, messageId) {
    try {
        const quiz = await findQuizById(quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        // Set editing state
        activeQuizCreation.set(chatId, {
            step: 'editTimer',
            quizId: quizId,
            messageId: messageId,
            currentTimeLimit: quiz.timeLimit
        });

        await bot.sendMessage(chatId, 
            "Savollar uchun yangi vaqt limitini oʻrnating. Bot vaqt yakunlanishi bilan odamlarga keyingi savolni yuboradi.", {
                reply_markup: {
                    keyboard: [
                        [{ text: "10 Seconds" }, { text: "15 Seconds" }, { text: "30 Seconds" }],
                        [{ text: "45 Seconds" }, { text: "1 Minute" }, { text: "2 Minutes" }],
                        [{ text: "3 Minutes" }, { text: "4 Minutes" }, { text: "5 Minutes" }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
        });

    } catch (error) {
        console.error('Edit timer error:', error);
        await bot.sendMessage(chatId, "Vaqt chegarasini tahrirlashda xatolik yuz berdi.");
    }
}

export async function handleEditMixing(bot, chatId, quizId, messageId) {
    try {
        const quiz = await findQuizById(quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        activeQuizCreation.set(chatId, {
            step: 'editMixing',
            quizId: quizId,
            messageId: messageId,
            currentMixing: quiz.mixing
        });

        await bot.sendMessage(chatId, "Savollar va javob variantlari aralashtirilsinmi?", {
            reply_markup: {
                keyboard: [
                    [{ text: "Barchasini aralashtirish" }, { text: "Aralashtirilmasin" }],
                    [{ text: "Faqat savollar" }, { text: "Faqat javoblar" }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
    } catch (error) {
        console.error('Edit mixing error:', error);
        await bot.sendMessage(chatId, "Aralashtirish sozlamalarini tahrirlashda xatolik yuz berdi.");
    }
}





export async function handleDeleteQuestion(bot, chatId, quizId, questionIndex, messageId) {
    try {
        const quizData = await readQuizData();
        const quiz = quizData[chatId].find(q => q.id === quizId);

        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        // Remove the question at the specified index
        quiz.questions.splice(questionIndex - 1, 1);
        await saveQuizData(quizData);

        const page = Math.ceil(questionIndex / QUESTIONS_PER_PAGE);

        // Calculate pagination
        const totalPages = Math.ceil(quiz.questions.length / QUESTIONS_PER_PAGE);
        const startIndex = (page - 1) * QUESTIONS_PER_PAGE;
        const endIndex = Math.min(startIndex + QUESTIONS_PER_PAGE, quiz.questions.length);

        // Update the message with new question list
        let message = `🎲 '<b>${quiz.title}</b>' testi \n` +
            `🖊 ${quiz.questions.length} ta savol\n\n` +
            `📄 Sahifa ${page}/${totalPages}\n\n`;

        for (let i = startIndex; i < endIndex; i++) {
            const question = quiz.questions[i];
            message += `${i + 1}. ${question.question}\n`;
            if (quiz.questions.length != 1) {
                message += `/deleteQuestion_${quizId}_${i + 1}\n\n`;
            }
        }

        // Create pagination buttons
        const inlineKeyboard = [];

        // Navigation row
        const navigationRow = [];
        if (page > 1) {
            navigationRow.push({ 
                text: "⬅️ Oldingi", 
                callback_data: `editQuestions_${quizId}_${page - 1}` 
            });
        }
        if (page < totalPages) {
            navigationRow.push({ 
                text: "Keyingi ➡️", 
                callback_data: `editQuestions_${quizId}_${page + 1}` 
            });
        }
        if (navigationRow.length > 0) {
            inlineKeyboard.push(navigationRow);
        }

        // Action buttons
        inlineKeyboard.push([{ 
            text: "Yangi savol qo'shish", 
            callback_data: `createQuestion_${quizId}` 
        }]);
        inlineKeyboard.push([{ 
            text: "<< Orqaga qaytish", 
            callback_data: `return_${quizId}` 
        }]);

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: inlineKeyboard
            },
            parse_mode: 'HTML'
        });

    } catch (error) {
        console.error('Delete question error:', error);
        await bot.sendMessage(chatId, "Savolni o'chirishda xatolik yuz berdi.");
    }
}


export async function handleCreateQuestion(bot, chatId, quizId, messageId) {
    try {
        // Set the state for question creation
        activeQuizCreation.set(chatId, {
            step: 'addQuestion',
            quizId: quizId,
            questions: [],
            messageId: messageId
        });

        await bot.sendMessage(chatId, 
            "Menga keyingi savolingiz bilan soʻrovnoma yuboring. Bunga muqobil ravishda, bu savoldan oldin koʻrsatiladigan matn yoki mediafayl bilan xabar yuborishingiz mumkin.", {
            reply_markup: {
                keyboard: [[{ text: "Savol tuzish", request_poll: { type: "quiz" } }]],
                resize_keyboard: true
            }
        });

    } catch (error) {
        console.error('Create question error:', error);
        await bot.sendMessage(chatId, "Savol yaratishda xatolik yuz berdi.");
    }
}