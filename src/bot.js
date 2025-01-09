import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import { setupCallbackHandlers } from './handlers/callback.handler.js';
import { setupCommandHandlers } from './handlers/command.handler.js';
import { setupMessageHandlers } from './handlers/message.handler.js';
import { setupPollHandlers } from './handlers/poll.handler.js';
import { setupInlineHandlers } from './handlers/inline.handler.js';

dotenv.config();

// Global state with WeakMap for better memory management
export const activeQuizCreation = new Map();
export const activeQuizSessions = new Map();
export const activeGroupQuizSessions = new Map();
export const activeMessageId = new Map();


async function handleBlockedUser(chatId) {
    try {
        // Remove user from active sessions
        activeQuizSessions.delete(chatId);
        activeQuizCreation.delete(chatId);
        activeMessageId.delete(chatId);

        // Clean up group sessions if this was a group
        if (activeGroupQuizSessions.has(chatId)) {
            activeGroupQuizSessions.delete(chatId);
        }
        
        // You might want to mark the user as inactive in your database
        // await updateUserStatus(chatId, 'inactive');
        
        console.log(`Cleaned up data for blocked user/group ${chatId}`);
    } catch (error) {
        console.error('Error handling blocked user:', error);
    }
}

const BOT_CONFIG = {
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    },
    filepath: false
};

// MongoDB connection with optimized settings
const MONGO_CONFIG = {
    dbName: 'quizbot',
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 50,
    minPoolSize: 10
};

const connectDB = async (retries = 5) => {
    try {
        await mongoose.connect(process.env.MONGO_URI, MONGO_CONFIG);
        console.log('MongoDB connected successfully');
    } catch (error) {
        if (retries > 0) {
            console.log(`MongoDB connection failed. Retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connectDB(retries - 1);
        }
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Error handling middleware
const setupErrorHandlers = (bot) => {
    const errorHandler = (type = 'error') => async (error) => {
        if (error.code === 'ETELEGRAM') {
            const chatId = error.response?.body?.parameters?.chat_id;
            
            if (error.response.statusCode === 403) {
                if (chatId) {
                    await handleBlockedUser(chatId);
                }
                console.log(`${type} error: Bot blocked by user/group ${chatId}`);
                return;
            }
            
            // Handle other Telegram API errors
            console.log(`${type} error: ${error.response.body.description}`);
            return;
        }
        
        // Log non-Telegram errors but don't crash
        console.error(`${type} error:`, error);
    };
    errorHandler()

    bot.on('polling_error', errorHandler('Polling'));
    bot.on('error', errorHandler('Bot'));
    bot.on('webhook_error', errorHandler('Webhook'));
};

// Cleanup function
const cleanup = async () => {
    try {
        console.log('Shutting down gracefully...');
        await bot.stopPolling();
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
};

// Initialize bot
const initializeBot = async () => {
    try {
        await connectDB();
        
        const bot = new TelegramBot(process.env.TG_API_TOKEN, BOT_CONFIG);
        setupErrorHandlers(bot);

        // Setup handlers with error boundaries
        const handlers = [
            setupCommandHandlers,
            setupCallbackHandlers,
            setupMessageHandlers,
            setupPollHandlers,
            setupInlineHandlers
        ];

        handlers.forEach(handler => {
            try {
                handler(bot);
            } catch (error) {
                console.error(`Error setting up handler: ${handler.name}`, error);
            }
        });

        // Setup graceful shutdown
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        console.log('Bot is running...');
        return bot;
    } catch (error) {
        console.error('Bot initialization error:', error);
        process.exit(1);
    }
};

const bot = await initializeBot();
export default bot;