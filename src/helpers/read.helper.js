import fs from 'fs/promises';

// Cache for quiz data
const messageCache = new Map();

// Cache timeout (5 minutes)
const CACHE_TIMEOUT = 5 * 60 * 1000;

// Function to read quiz data
export async function readQuizData() {
    try {
        if (messageCache.has('quizData')) {
            return messageCache.get('quizData');
        }
        const data = await fs.readFile('quizData.json', 'utf8');
        const parsedData = JSON.parse(data);
        messageCache.set('quizData', parsedData);
        
        // Clear cache after timeout
        setTimeout(() => {
            messageCache.delete('quizData');
        }, CACHE_TIMEOUT);
        
        return parsedData;
    } catch (error) {
        console.error('Error reading quiz data:', error);
        return {};
    }
}

// Variable for debounced save
let saveTimeout;

// Function to save quiz data
export async function saveQuizData(data) {
    try {
        // Update cache immediately
        messageCache.set('quizData', data);
        
        // Clear existing timeout
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        // Debounce write operations
        saveTimeout = setTimeout(async () => {
            try {
                await fs.writeFile('quizData.json', JSON.stringify(data, null, 2));
            } catch (error) {
                console.error('Error saving quiz data:', error);
            }
        }, 1000); // 1 second debounce
    } catch (error) {
        console.error('Error in saveQuizData:', error);
    }
}
