import { startQuiz, startGroupQuiz } from '../services/quiz.service.js';
import { 
    handleViewTests, handleCreateTest, handleStartQuiz, handleReady, handleGroupReady, handleStatistics,
    handleReturn, handleEdit, handleDeleteTest
} from './handler.functions.callback.js';

export function setupCallbackHandlers(bot) {
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        const user = callbackQuery.from;

        try {
            if (data === 'view_tests') {
                await handleViewTests(chatId, bot)
            } else if (data === 'create_test') {
                await handleCreateTest(chatId, bot)
            } else if (data.startsWith('start_')) {
                const quizId = data.split('start_')[1];
                await handleStartQuiz(bot, chatId, quizId, user);
            } else if (data.startsWith('ready_')) {
                const quizId = data.split('ready_')[1];
                await handleReady(bot, chatId, quizId)
            } else if (data.startsWith('retake_')) {
                const quizId = data.split('retake_')[1];
                await startQuiz(bot, chatId, quizId, user, true);
            } else if (data.startsWith('share_')) {
                const botDetails = await bot.getMe();
                const quizId = data.split('share_')[1];

                const shareLink = `t.me/${botDetails.username}?start=${quizId}`;
                await bot.sendMessage(chatId, `Share this link to invite others:\n${shareLink}`);

            } else if (data.startsWith('group_ready_')) {
                const quizId = data.split('group_ready_')[1];
                await handleGroupReady(bot, chatId, quizId, user)
            } else if (data.startsWith('stats_')) {
                const quizId = data.split('stats_')[1];
                const messageId = callbackQuery.message.message_id;
                await handleStatistics(bot, chatId, quizId, messageId)
            } else if (data.startsWith('return_')) {
                const quizId = data.split('return_')[1];
                const messageId = callbackQuery.message.message_id;
                await handleReturn(bot, chatId, quizId, messageId)
            } else if (data.startsWith('edit_')) {
                const quizId = data.split('edit_')[1];
                const messageId = callbackQuery.message.message_id;
                await handleEdit(bot, chatId, quizId, messageId)
            } else if (data.startsWith('deleteTest_')) {
                const quizId = data.split('deleteTest_')[1];
                const messageId = callbackQuery.message.message_id;
                await handleDeleteTest(bot, chatId, quizId, messageId)
            } 
            // else if (data.startsWith('editQuestions_')) {
            //     const quizId = data.split('editQuestions_')[1];
            //     const messageId = callbackQuery.message.message_id;
            //     await handleEditQuestion(bot, chatId, quizId, messageId)
            // }
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
                await startGroupQuiz(bot, msg.chat.id, quizId, msg.from);
            }
        }
    });
}
