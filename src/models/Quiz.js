import mongoose from 'mongoose';

const QuizSchema = new mongoose.Schema({
    id: { 
        type: String, 
        required: true, 
        unique: true 
    },
    creator: Number,
    title: String,
    description: { type: String, default: '' },
    questions: [{
        question: String,
        options: [String],
        correctAnswer: Number,
        preQuestionContent: {
            type: {
                type: String,
                enum: ['text', 'photo', 'document', 'video', 'audio', 'unknown']
            },
            content: { type: String, default: '' },
            fileId: String
        }
    }],
    mixing: {
        type: String,
        enum: ['barchasi', 'aralashtirilmaydi', 'savollar', 'javoblar']
    },
    timeLimit: Number,
    created: { type: Date, default: Date.now },
    leaderboard: [{
        chatId: Number,
        username: { type: String, default: '' },
        firstName: { type: String, default: '' },
        lastName: { type: String, default: '' },
        correctAnswers: { type: Number, default: 0 },
        wrongAnswers: { type: Number, default: 0 },
        skippedQuestions: { type: Number, default: 0 },
        timestamp: { type: Date, default: Date.now }
    }]
}, { 
    _id: false  // Disable automatic _id
});

export const Quiz = mongoose.model('Quiz', QuizSchema);