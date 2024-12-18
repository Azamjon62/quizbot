import mongoose from 'mongoose';

const QuizSchema = new mongoose.Schema({
    id: { 
        type: String, 
        required: true, 
        unique: true 
    },
    creator: Number,
    title: String,
    description: String,
    questions: [{
        question: String,
        options: [String],
        correctAnswer: Number,
        preQuestionContent: {
            type: {
                type: String,
                enum: ['text', 'photo', 'document', 'video', 'audio', 'unknown']
            },
            content: String,
            fileId: String
        }
    }],
    timeLimit: Number,
    created: { type: Date, default: Date.now },
    leaderboard: [{
        chatId: Number,
        username: String,
        firstName: String,
        lastName: String,
        correctAnswers: Number,
        timestamp: { type: Date, default: Date.now }
    }]
}, { 
    _id: false  // Disable automatic _id
});

export const Quiz = mongoose.model('Quiz', QuizSchema);