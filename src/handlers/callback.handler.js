import { startQuiz, startGroupQuiz } from '../services/quiz.service.js';
import { 
    handleViewTests, handleCreateTest, handleStartQuiz, handleReady, handleGroupReady, handleStatistics,
    handleReturn, handleEdit, handleDeleteTest, handleEditQuestion, handleEditTitle, handleEditDescription, handleEditTimer, handleCreateQuestion, handleEditMixing,
    handleViewTestsPages
} from './handler.functions.callback.js';

export function setupCallbackHandlers(bot) {
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        const user = callbackQuery.from;

        try {
            if (data === 'view_tests') {
                await handleViewTests(chatId, bot, 1)
            } else if (data.startsWith('viewTests_')) {
                const page = parseInt(data.split('_')[1]);
                const messageId = callbackQuery.message.message_id;
                if (!isNaN(page)) {
                    await handleViewTestsPages(chatId, bot, messageId, page);
                }
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
                await handleGroupReady(bot, chatId, quizId, user, callbackQuery)
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
            } else if (data.startsWith('editQuestions_')) {
                const [, quizId, page] = data.split('_');
                const messageId = callbackQuery.message.message_id;
                await handleEditQuestion(bot, chatId, quizId, messageId, parseInt(page) || 1)
            } else if (data.startsWith('editTitle_')) {
                const quizId = data.split('editTitle_')[1];
                const messageId = callbackQuery.message.message_id;
                await handleEditTitle(bot, chatId, quizId, messageId);
            } else if (data.startsWith('editDescription_')) {
                const quizId = data.split('editDescription_')[1];
                const messageId = callbackQuery.message.message_id;
                await handleEditDescription(bot, chatId, quizId, messageId);
            } else if (data.startsWith('editTimer_')) {
                const quizId = data.split('editTimer_')[1];
                const messageId = callbackQuery.message.message_id;
                await handleEditTimer(bot, chatId, quizId, messageId);
            } else if (data.startsWith('createQuestion_')) {
                const quizId = data.split('createQuestion_')[1];
                const messageId = callbackQuery.message.message_id;
                await handleCreateQuestion(bot, chatId, quizId, messageId);
            } else if (data.startsWith('editMixing_')) {
                const quizId = data.split('editMixing_')[1];
                const messageId = callbackQuery.message.message_id;
                await handleEditMixing(bot, chatId, quizId, messageId);
            }
        } catch (error) {
            console.error('Callback query error:', error);
            await bot.sendMessage(chatId, "An error occurred while geting Callback. Please try again.");
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
