import { activeQuizSessions, activeQuizCreation, activeGroupQuizSessions } from '../bot.js';
import { findQuizById } from '../helpers/quiz.helper.js';
import { showQuizResults, showGroupQuizResults } from '../services/quiz.service.js';

export function setupPollHandlers(bot) {
    bot.on('poll', async (poll) => {
        try {
            const chatId = Array.from(activeQuizCreation.keys()).find(
                id => activeQuizCreation.get(id).step === 'questions'
            );

            if (!chatId) return;

            const userState = activeQuizCreation.get(chatId);
            const pollData = poll.poll || poll;

            const questionObj = {
                question: pollData.question,
                options: pollData.options.map(opt => opt.text),
                correctAnswer: pollData.correct_option_id
            };

            if (userState.pendingPreQuestionContent) {
                questionObj.preQuestionContent = userState.pendingPreQuestionContent;
                userState.pendingPreQuestionContent = null;
            }

            userState.questions.push(questionObj);

            await bot.sendMessage(chatId, 
                `Yaxshi. <i>"</i><b>${userState.title}</b><i>"</i> testingizda hozirda ${userState.questions.length} ta savol bor. Agar savolda xatoga yoʻl qoʻygan boʻlsangiz, /undo buyrugʻini yuborish orqali orqaga qaytarishingiz mumkin. \n\nEndi keyingi savolni yoki undan oldin koʻrsatiladigan matn yoki mediafaylni yuboring. \n\nBajarganingizdan keyin, test tuzishni yakunlash uchun shunchaki /done buyrugʻini yuboring.`, {
                reply_markup: {
                    keyboard: [[{ text: "Savol tuzish", request_poll: { type: "quiz" } }]],
                    resize_keyboard: true
                },
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Poll handler error:', error);
            if (chatId) {
                await bot.sendMessage(chatId, "Savolingizni qo'shishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
            }
        }
    });

    bot.on('poll_answer', async (pollAnswer) => {
        try {
            // Check for group quiz first
            let groupChatId;
            let groupSession;

            for (const [chatId, session] of activeGroupQuizSessions.entries()) {
                if (session.currentPollId === pollAnswer.poll_id) {
                    groupChatId = chatId;
                    groupSession = session;
                    break;
                }
            }

            // Handle group quiz answer
            if (groupSession) {
                const quiz = await findQuizById(groupSession.quizId);
                if (!quiz) return;

                const currentQuestionIndex = groupSession.currentQuestion - 1;
                const question = quiz.questions[currentQuestionIndex];
                if (!question) return;

                let participant = groupSession.participants.get(pollAnswer.user.id);
                if (!participant) {
                    participant = {
                        userId: pollAnswer.user.id,
                        username: pollAnswer.user.username,
                        firstName: pollAnswer.user.first_name,
                        lastName: pollAnswer.user.last_name,
                        correctAnswers: 0,
                        wrongAnswers: 0,
                        answers: new Set()
                    };
                    groupSession.participants.set(pollAnswer.user.id, participant);
                }

                if (!participant.answers.has(currentQuestionIndex)) {
                    participant.answers.add(currentQuestionIndex);
                    
                    if (pollAnswer.option_ids[0] === question.correctAnswer) {
                        participant.correctAnswers++;
                    } else {
                        participant.wrongAnswers++;
                    }
                }

                await sendGroupQuizQuestion(bot, groupChatId);
            }

            // Check for private quiz
            const privateSession = activeQuizSessions.get(pollAnswer.user.id);
            if (privateSession) {
                const quiz = await findQuizById(privateSession.quizId);
                if (!quiz) return;

                const question = quiz.questions[privateSession.currentQuestion];
                if (!question) return;

                if (privateSession.timeout) {
                    clearTimeout(privateSession.timeout);
                }

                privateSession.answeredQuestions = (privateSession.answeredQuestions || 0) + 1;
                if (pollAnswer.option_ids[0] === question.correctAnswer) {
                    privateSession.score = (privateSession.score || 0) + 1;
                }

                privateSession.currentQuestion++;
                await sendQuizQuestion(bot, pollAnswer.user.id);
            }

        } catch (error) {
            console.error('Poll answer error:', error);
        }
    });
}

export async function sendQuizQuestion(bot, chatId) {
    try {
        const session = activeQuizSessions.get(chatId);
        if (!session) return;        

        const quiz = await findQuizById(session.quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Quiz not found.");
            return;
        }

        if (session.currentQuestion >= quiz.questions.length) {
            await showQuizResults(bot, chatId, session);
            activeQuizSessions.delete(chatId);
            return;
        }
        
        const question = quiz.questions[session.currentQuestion];

        if (question.preQuestionContent) {
            const { type, content, fileId } = question.preQuestionContent;
            
            if (type === 'photo' && fileId) {
                if (content) {
                    await bot.sendPhoto(chatId, fileId, { caption: content });
                } else {
                    await bot.sendPhoto(chatId, fileId);
                }
            } else if (type === 'document' && fileId) {
                if (content) {
                    // await bot.sendAnimation(chatId, fileId, {caption: content})
                    await bot.sendDocument(chatId, fileId, {caption: content})
                } else {
                    // await bot.sendAnimation(chatId, fileId)
                    await bot.sendDocument(chatId, fileId)
                }
            } else if (content) {
                await bot.sendMessage(chatId, content);
            }
        }

        if (session.timeout) {
            clearTimeout(session.timeout);
        }

        const poll = await bot.sendPoll(chatId, 
            `[${session.currentQuestion+1}/${quiz.questions.length}]${question.question}`,
            question.options,
            {
                type: 'quiz',
                correct_option_id: question.correctAnswer,
                is_anonymous: false,
                open_period: quiz.timeLimit
            }
        );

        session.timeout = setTimeout(async () => {
            session.currentQuestion++;
            session.skippedAnswers = (session.skippedAnswers || 0) + 1;
            await sendQuizQuestion(bot, chatId);
        }, quiz.timeLimit * 1000);

    } catch (error) {
        console.error('Send question error:', error);
        await bot.sendMessage(chatId, "An error occurred while sending the question.");
    }
}

export async function sendGroupQuizQuestion(bot, chatId) {
    try {
        const session = activeGroupQuizSessions.get(chatId);
        if (!session) return;        

        const quiz = await findQuizById(session.quizId);
        if (!quiz) {
            await bot.sendMessage(chatId, "Test topilmadi.");
            return;
        }

        if (session.currentQuestion >= quiz.questions.length) {
            await showGroupQuizResults(bot, chatId, session, quiz);
            activeGroupQuizSessions.delete(chatId);
            return;
        }
        
        const question = quiz.questions[session.currentQuestion];

        if (question.preQuestionContent) {
            const { type, content, fileId } = question.preQuestionContent;
            
            if (type === 'photo' && fileId) {
                if (content) {
                    await bot.sendPhoto(chatId, fileId, { caption: content });
                } else {
                    await bot.sendPhoto(chatId, fileId);
                }
            } else if (type === 'document' && fileId) {
                if (content) {
                    // await bot.sendAnimation(chatId, fileId, {caption: content})
                    await bot.sendDocument(chatId, fileId, {caption: content})
                } else {
                    // await bot.sendAnimation(chatId, fileId)
                    await bot.sendDocument(chatId, fileId)
                }
            } else if (content) {
                await bot.sendMessage(chatId, content);
            }
        }

        if (session.timeout) {
            clearTimeout(session.timeout);
        }

        const poll = await bot.sendPoll(chatId, 
            `[${session.currentQuestion+1}/${quiz.questions.length}]${question.question}`,
            question.options,
            {
                type: 'quiz',
                correct_option_id: question.correctAnswer,
                is_anonymous: false,
                open_period: quiz.timeLimit
            }
        );

        // Store the poll ID in the session
        session.currentPollId = poll.poll.id;
        session.currentQuestion++;

        session.timeout = setTimeout(async () => {
            if (activeGroupQuizSessions.has(chatId)) {
                await sendGroupQuizQuestion(bot, chatId);  // Fixed: Call sendGroupQuizQuestion instead of sendQuizQuestion
            }
        }, quiz.timeLimit * 1000);

    } catch (error) {
        console.error('Send group question error:', error);
        await bot.sendMessage(chatId, "Savolni yuborishda xatolik yuz berdi.");
    }
}
