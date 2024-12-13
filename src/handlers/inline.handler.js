import { readQuizData } from '../helpers/read.helper.js';

export function setupInlineHandlers(bot) {
    bot.on('inline_query', async (query) => {
        try {
            const userId = query.from.id;
            const searchText = query.query.toLowerCase();
            const botInfo = await bot.getMe();
            
            const quizData = await readQuizData();
            const userQuizzes = quizData[userId] || [];

            const filteredQuizzes = userQuizzes.filter(quiz => 
                quiz.title.toLowerCase().includes(searchText) ||
                quiz.description.toLowerCase().includes(searchText) ||
                quiz.id.toLowerCase().includes(searchText)
            );

            const results = filteredQuizzes.map((quiz, index) => ({
                id: index.toString(),
                type: 'article',
                title: quiz.title,
                description: `${quiz.questions.length} ta savol · ${quiz.timeLimit} soniya`,
                input_message_content: {
                    message_text: `📝 <b>${quiz.title}</b> testi\n` +
                        `${quiz.description ? quiz.description + '\n\n' : ''}` +
                        `🖊 ${quiz.questions.length} ta savol · ` +
                        `⏱ ${quiz.timeLimit} soniya\n`,
                    parse_mode: 'HTML'
                },
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "Bu testni boshlash", url: `https://t.me/${botInfo.username}?start=${quiz.id}` }],
                        [{ text: "Guruhda testni boshlash", url: `https://t.me/${botInfo.username}?startgroup=${quiz.id}&admin=can_post_messages%2Ccan_manage_topics%2Ccan_delete_messages` }],
                        [{ text: "Testni ulashish", switch_inline_query: `${quiz.id}` }]
                    ]
                }
            }));

            await bot.answerInlineQuery(query.id, results, {
                cache_time: 10,
                switch_pm_text: "Yangi test tuzish",
                switch_pm_parameter: "create_test"
            });

        } catch (error) {
            console.error('Inline query error:', error);
        }
    });
}
