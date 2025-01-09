import { activeQuizCreation, activeMessageId } from '../bot.js';
import { v4 as uuidv4 } from 'uuid';
import { readQuizData, saveQuizData } from '../helpers/read.helper.js';
import { handleEdit, handleDelete, handleEditedTest, handleReturn } from './handler.functions.callback.js';
import { findQuizById } from '../helpers/quiz.helper.js';

const QUESTIONS_PER_PAGE = 20;

export function setupMessageHandlers(bot) {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        const userState = activeQuizCreation.get(chatId);

        const timeMapping = {
            '10 Seconds': 10,
            '15 Seconds': 15,
            '30 Seconds': 30,
            '45 Seconds': 45,
            '1 Minute': 60,
            '2 Minutes': 120,
            '3 Minutes': 180,
            '4 Minutes': 240,
            '5 Minutes': 300
        };

        const mixingOptions = {
            'Barchasini aralashtirish': 'barchasi',
            'Aralashtirilmasin': 'aralashtirilmaydi',
            'Faqat savollar': 'savollar',
            'Faqat javoblar': 'javoblar'
        };

        if (!userState) return;
    
        switch (userState.step) {
            case 'title':
                userState.title = text;
                userState.step = 'description';
                userState.questions = [];
                await bot.sendMessage(chatId, 
                    "Yaxshi. Endi menga testingiz tavsifini yuboring. Bu ixtiyoriy, bu bosqichni tashlab ketishingiz mumkin: /skip.");
                break;
    
            case 'description':
                if (text === '/skip') {
                    userState.description = '';
                } else {
                    userState.description = text;
                }
                userState.step = 'questions';
                await bot.sendMessage(chatId, 
                    "Yaxshi. Endi menga birinchi savolingiz bilan <b>soʻrovnoma</b> yuboring. Bunga muqobil ravishda, bu savoldan oldin koʻrsatiladigan <b>matn</b> yoki <b>mediafayl</b> bilan xabar yuborishingiz mumkin.\n\n<b>Diqqat: bu bot anonim soʻrovnomalarni tuza olmaydi. Guruhlardagi foydalanuvchilar boshqa foydalanuvchilardan ovozlarni koʻra oladi.</b>", {
                    reply_markup: {
                        keyboard: [[{ text: "Savol tuzish", request_poll: { type: "quiz" } }]],
                        one_time_keyboard: true,
                        resize_keyboard: true
                    },
                    parse_mode: 'HTML'
                });
                break;
    
            case 'questions':
                if (text === '/done') {
                    if (userState.questions.length === 0) {
                        await bot.sendMessage(chatId, "Siz hali hech qanday savol qo'shmadingiz. Iltimos, kamida bitta savol qo'shing.");
                        return;
                    }
                    userState.step = 'time_limit';
                    await bot.sendMessage(chatId, 
                        "Savollar uchun vaqt belgilang. Guruhlarda bot vaqt tugashi bilanoq keyingi savolni yuboradi. \n\nAgar savolingiz murakkab masalalarni oʻz ichiga olsa (masalan, matematika va boshqalar), uzoqroq vaqt ajratishingizni maslahat beramiz. Koʻplab oddiy testlar uchun 10-30 soniya kifoya qiladi.", {
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
                } else if (text === '/undo') {
                    if (userState.questions.length > 0 || userState.pendingPreQuestionContent) {
                        userState.questions.pop();
                        await bot.sendMessage(chatId,
                            `Oxirgi savol oʻchirildi. Testingizda hozir <b>${userState.questions.length}</b> ta savol bor. \n\nBunga muqobil ravishda, bu savoldan oldin koʻrsatiladigan <b>matn</b> yoki <b>mediafayl</b> bilan xabar yuborishingiz mumkin.\n\nYoki savol tuzishingiz mumkin`, {
                            parse_mode: 'HTML'
                        });
                    }
                } else if (msg.poll) {
                    return;
                } else {
                    const preQuestionContent = {
                        type: msg.text ? 'text' : 
                              msg.photo ? 'photo' :
                              msg.video ? 'video' :
                              msg.document ? 'document' :
                              msg.audio ? 'audio' : 'unknown',
                        content: msg.text || msg.caption || '',
                        fileId: msg.photo ? msg.photo[msg.photo.length - 1].file_id :
                                msg.video ? msg.video.file_id :
                                msg.document ? msg.document.file_id :
                                msg.audio ? msg.audio.file_id : null
                    };
    
                    userState.pendingPreQuestionContent = preQuestionContent;
    
                    await bot.sendMessage(chatId, 
                        "Ajoyib! Endi tugmadan foydalanib, menga ushbu xabarga tegishli savolni yuboring. Agar xabarni xato yuborgan bo'lsangiz, /undo buyrug'ini yuboring.", {
                        reply_to_message_id: msg.message_id,
                        reply_markup: {
                            keyboard: [[{ text: "Savol tuzish", request_poll: { type: "quiz" } }]],
                            resize_keyboard: true
                        }
                    });
                }
                break;
    
            case 'time_limit':
                if (timeMapping[text]) {
                    userState.timeLimit = timeMapping[text];

                    userState.step = 'mixingTest';

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
                }
                break;
                
            case 'mixingTest':
                if (mixingOptions[text]) {
                    userState.mixing = mixingOptions[text];
                    const quizId = uuidv4().split('-')[0];
                    const quizData = await readQuizData();
                    const botDetails = await bot.getMe();

                    if (!quizData[chatId]) {
                        quizData[chatId] = [];
                    }                    

                    const newQuiz = {
                        id: quizId,
                        title: userState.title,
                        description: userState.description,
                        questions: userState.questions,
                        mixing: userState.mixing,
                        timeLimit: userState.timeLimit,
                        creator: chatId,
                        created: new Date().toISOString()
                    };

                    quizData[chatId].push(newQuiz);
                    await saveQuizData(quizData);

                    const shareLink = `t.me/testsquizz_bot?start=${quizId}`;

                    await bot.sendMessage(chatId, '👍 Test Tuzildi.', {reply_markup: {
                        remove_keyboard: true
                    }});

                    await bot.sendMessage(chatId, 
                        `<b>${userState.title}</b> <i>Hechkim javaob bermadi</i> \n${userState.description ? userState.description : ''} \n🖊 <b>${userState.questions.length}</b> ta savol · ⏱ <b>${userState.timeLimit}</b> soniya  · ${userState.mixing == 'barchasi' ? '🔀' : userState.mixing == 'aralashtirilmaydi' ? '⏬' : userState.mixing == 'savollar' ? '🔀' : userState.mixing == 'javoblar' ? '🔀' : ''} ${userState.mixing} \n\n<b>External sharing link:</b>\n${shareLink}`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Bu testni boshlash', callback_data: `start_${quizId}` }],
                                [{ text: 'Guruhda testni boshlash', url: `https://t.me/${botDetails.username}?startgroup=${quizId}` }],
                                [{ text: 'Testni ulashish', switch_inline_query: `${quizId}` }],
                                [{ text: 'Testni tahrirlash', callback_data: `edit_${quizId}` }],
                                [{ text: 'Test statistikasi', callback_data: `stats_${quizId}` }]
                            ]
                        },
                        parse_mode: 'HTML'
                    });

                    activeQuizCreation.delete(chatId);
                }
                break

            case 'editTitle':
                if (text === '/back') {
                    activeQuizCreation.delete(chatId);
                    await handleReturn(bot, chatId, userState.quizId, userState.messageId);
                    await handleEditedTest(bot, chatId, userState.quizId);
                    return;
                }
                
                const quiz = await findQuizById(userState.quizId);
                if (!quiz) {
                    await bot.sendMessage(chatId, "Test topilmadi.");
                    return;
                }

                quiz.title = text;
                await quiz.save();

                await bot.sendMessage(chatId, "👍 Sarlavha yangilandi.");
                await handleDelete(bot, chatId, userState.messageId);
                await handleEditedTest(bot, chatId, userState.quizId);
                activeQuizCreation.delete(chatId);

                break;
        
            case 'editDescription':
                if (text === '/skip') {
                    activeQuizCreation.delete(chatId);
                    await handleReturn(bot, chatId, userState.quizId, userState.messageId);
                    await handleEditedTest(bot, chatId, userState.quizId);
                    return;
                }

                const quizToUpdate = await findQuizById(userState.quizId);
                if (!quizToUpdate) {
                    await bot.sendMessage(chatId, "Test topilmadi.");
                    return;
                }

                quizToUpdate.description = text;
                await quizToUpdate.save();

                await bot.sendMessage(chatId, "👍 Tavsif yangilandi.");
                await handleDelete(bot, chatId, userState.messageId);
                await handleEditedTest(bot, chatId, userState.quizId);
                activeQuizCreation.delete(chatId);
                break;
        
            case 'editTimer':
                if (timeMapping[text]) {
                    const quiz = await findQuizById(userState.quizId);
                    if (!quiz) {
                        await bot.sendMessage(chatId, "Test topilmadi.");
                        return;
                    }
            
                    quiz.timeLimit = timeMapping[text];
                    await quiz.save();
            
                    await bot.sendMessage(chatId, "👍 Taymer sozlamalari yangilandi.", {
                        reply_markup: { remove_keyboard: true }
                    });
                    await handleDelete(bot, chatId, userState.messageId);
                    await handleEditedTest(bot, chatId, userState.quizId);
                    activeQuizCreation.delete(chatId);
                }
                break;

            case 'addQuestion':
                if (msg.poll) {
                    const quizData = await readQuizData();
                    const quiz = quizData[chatId].find(q => q.id === userState.quizId);
                    
                    if (!quiz) {
                        await bot.sendMessage(chatId, "Test topilmadi.");
                        return;
                    }                    
            
                    const newQuestion = {
                        question: msg.poll.question,
                        options: msg.poll.options.map(opt => opt.text),
                        correctAnswer: msg.poll.correct_option_id,
                        preQuestionContent: userState.pendingPreQuestionContent || null
                    };
            
                    quiz.questions.push(newQuestion);
                    await saveQuizData(quizData);

                    // Calculate current page (show the last page after adding new question)
                    const totalPages = Math.ceil(quiz.questions.length / QUESTIONS_PER_PAGE);
                    const currentPage = totalPages; // Go to last page
                    const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
                    const endIndex = Math.min(startIndex + QUESTIONS_PER_PAGE, quiz.questions.length);
            
                    // Update the questions list message
                    let message = `🎲 '<b>${quiz.title}</b>' testi \n` +
                        `🖊 ${quiz.questions.length} ta savol\n\n` +
                        `📄 Sahifa ${currentPage}/${totalPages}\n\n`;
            
                    // Show only questions for current page
                    for (let i = startIndex; i < endIndex; i++) {
                        const question = quiz.questions[i];
                        message += `${i + 1}. ${question.question}\n`;
                        message += `/deleteQuestion_${quiz.id}_${i + 1}\n\n`;
                    }

                    // Delete the previous message if exists
                    if (activeMessageId.get(chatId)) {
                        try {
                            await bot.deleteMessage(chatId, activeMessageId.get(chatId));
                        } catch (error) {
                            console.log('Error deleting previous message:', error);
                        }
                    }

                    await bot.sendMessage(chatId, '👍 Savol qo\'shildi.', {
                        reply_markup: {
                            remove_keyboard: true
                        }
                    });

                    // Create pagination buttons
                    const inlineKeyboard = [];

                    // Navigation row
                    const navigationRow = [];
                    if (currentPage > 1) {
                        navigationRow.push({ 
                            text: "⬅️ Oldingi", 
                            callback_data: `editQuestions_${quiz.id}_${currentPage - 1}` 
                        });
                    }
                    if (currentPage < totalPages) {
                        navigationRow.push({ 
                            text: "Keyingi ➡️", 
                            callback_data: `editQuestions_${quiz.id}_${currentPage + 1}` 
                        });
                    }
                    if (navigationRow.length > 0) {
                        inlineKeyboard.push(navigationRow);
                    }

                    // Action buttons
                    inlineKeyboard.push([{ 
                        text: "Yangi savol qo'shish", 
                        callback_data: `createQuestion_${quiz.id}` 
                    }]);
                    inlineKeyboard.push([{ 
                        text: "<< Orqaga qaytish", 
                        callback_data: `return_${quiz.id}` 
                    }]);

                    const messages = await bot.sendMessage(chatId, message, {
                        reply_markup: {
                            inline_keyboard: inlineKeyboard
                        },
                        parse_mode: 'HTML'
                    });
                    activeMessageId.set(chatId, messages.message_id);
                    
                    // Clear the creation state
                    activeQuizCreation.delete(chatId);
                } else {
                    userState.pendingPreQuestionContent = {
                        type: msg.text ? 'text' : 
                                msg.photo ? 'photo' :
                                msg.video ? 'video' :
                                msg.document ? 'document' :
                                msg.audio ? 'audio' : 'unknown',
                        content: msg.text || msg.caption || '',
                        fileId: msg.photo ? msg.photo[msg.photo.length - 1].file_id :
                                msg.video ? msg.video.file_id :
                                msg.document ? msg.document.file_id :
                                msg.audio ? msg.audio.file_id : null
                    };
            
                    await bot.sendMessage(chatId, 
                        "Ajoyib! Endi tugmadan foydalanib, menga ushbu xabarga tegishli savolni yuboring.", {
                        reply_to_message_id: msg.message_id,
                        reply_markup: {
                            keyboard: [[{ text: "Savol tuzish", request_poll: { type: "quiz" } }]],
                            resize_keyboard: true
                        }
                    });
                }
                break;
    
            case 'editMixing':
                if (mixingOptions[text]) {
                    const quiz = await findQuizById(userState.quizId);
                    if (!quiz) {
                        await bot.sendMessage(chatId, "Test topilmadi.");
                        return;
                    }

                    quiz.mixing = mixingOptions[text];
                    await quiz.save();

                    await bot.sendMessage(chatId, "👍 Tasodifiy sozlamalari yangilandi.", {reply_markup: {
                        remove_keyboard: true
                    }});
                    await handleDelete(bot, chatId, userState.messageId);
                    await handleEditedTest(bot, chatId, userState.quizId);
                    activeQuizCreation.delete(chatId);
                }

                break;
        }
    });
}
