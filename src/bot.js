import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import { setupCallbackHandlers } from './handlers/callback.handler.js';
import { setupCommandHandlers } from './handlers/command.handler.js';
import { setupMessageHandlers } from './handlers/message.handler.js';
import { setupPollHandlers } from './handlers/poll.handler.js';
import { setupInlineHandlers } from './handlers/inline.handler.js';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: 'quizbot'
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

await connectDB();

// Bot configuration
const bot = new TelegramBot(process.env.TG_API_TOKEN, {
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    },
    filepath: false
});

bot.on('polling_error', (error) => {
    console.log('Polling error:', error.message);
});

// Handle connection errors
bot.on('error', (error) => {
    console.log('Bot error:', error.message);
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error);
});


// Global state
export const activeQuizCreation = new Map();
export const activeQuizSessions = new Map();
export const activeGroupQuizSessions = new Map();

// Setup handlers
setupCommandHandlers(bot);
setupCallbackHandlers(bot);
setupMessageHandlers(bot);
setupPollHandlers(bot);
setupInlineHandlers(bot);

// Graceful shutdown
process.on('SIGINT', () => {
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    bot.stopPolling();
    process.exit(0);
});

console.log('Bot is running...');

export default bot;