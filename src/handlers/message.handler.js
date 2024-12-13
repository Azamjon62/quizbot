import { activeQuizCreation } from '../bot.js';
import { v4 as uuidv4 } from 'uuid';
import { readQuizData, saveQuizData } from '../helpers/read.helper.js';

export function setupMessageHandlers(bot) {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        const userState = activeQuizCreation.get(chatId);
    
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
                        },
                        parse_mode: 'HTML'
                    });
                }
                break;
    
            case 'time_limit':
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
    
                if (timeMapping[text]) {
                    userState.timeLimit = timeMapping[text];
                    const quizId = uuidv4().split('-')[0];
                    const quizData = await readQuizData();
                    const botDetails = await bot.getMe();
    
                    // Initialize user's quizzes array if it doesn't exist
                    if (!quizData[chatId]) {
                        quizData[chatId] = [];
                    }
                    
                    const newQuiz = {
                        id: quizId,
                        title: userState.title,
                        description: userState.description,
                        questions: userState.questions,
                        timeLimit: userState.timeLimit,
                        creator: chatId,
                        created: new Date().toISOString()
                    };
    
                    quizData[chatId].push(newQuiz);
                    await saveQuizData(quizData);
    
                    const shareLink = `t.me/testsquizz_bot?start=${quizId}`;
    
                    await bot.sendMessage(chatId, '👍 Test Tuzildi.');
                    
                    await bot.sendMessage(chatId, 
                        `<b>${userState.title}</b> <i>Hechkim javaob bermadi</i> \nTavsifini: ${userState.description}\n🖊 <b>${userState.questions.length}</b> ta savol · ⏱ <b>${userState.timeLimit}</b> soniya \n\n<b>External sharing link:</b>\n${shareLink}`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Bu testni boshlash', callback_data: `start_${quizId}` }],
                                [{ text: 'Guruhda testni boshlash', url: `https://t.me/${botDetails.username}?startgroup=${quizId}&admin=can_post_messages%2Ccan_manage_topics%2Ccan_delete_messages` }],
                                [{ text: 'Testni ulashish', switch_inline_query: `${quizId}` }],
                                [{ text: 'Testni tahrirlash', callback_data: `edit_${quizId}` }],
                                [{ text: 'Test statistikasi', callback_data: `stats_${quizId}` }]
                            ]
                        },
                        parse_mode: 'HTML'
                    });
    
                    activeQuizCreation.delete(chatId);
                }
                break;
        }
    });
}
