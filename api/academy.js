const fs = require('fs');
const path = require('path');

const ACADEMY_DATA_PATH = path.join(__dirname, '../data/academy.json');

// Helper to read data safely
function readData() {
    try {
        if (!fs.existsSync(ACADEMY_DATA_PATH)) {
            // Default initial structure
            const defaultData = {
                attendance: {},
                progress: {
                    math: { level: 1, points: 0, best_score: 0, history: [] },
                    reading: { level: 1, points: 0, history: [] },
                    typing: { level: 1, points: 0, best_wpm: 0, history: [] },
                    ai: { level: 1, points: 0, history: [] }
                },
                quests: []
            };
            fs.writeFileSync(ACADEMY_DATA_PATH, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const raw = fs.readFileSync(ACADEMY_DATA_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error("[Academy API] Error reading data:", e);
        return { attendance: {}, progress: {}, quests: [] };
    }
}

// Helper to write data safely
function writeData(data) {
    try {
        fs.writeFileSync(ACADEMY_DATA_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("[Academy API] Error writing data:", e);
        return false;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action } = req.query;

    try {
        // 1. LOAD FULL DATA
        if (req.method === 'GET' && action === 'load') {
            const data = readData();
            return res.json(data);
        }

        // 2. LOG ATTENDANCE
        if (req.method === 'POST' && action === 'attendance') {
            const { date, present, notes } = req.body;
            if (!date) return res.status(400).json({ error: 'Date is required' });

            const data = readData();
            data.attendance[date] = {
                present: !!present,
                notes: notes || "",
                logged_at: new Date().toISOString()
            };
            writeData(data);
            return res.json({ success: true, attendance: data.attendance[date] });
        }

        // 3. UPDATE PROGRESS
        if (req.method === 'POST' && action === 'progress') {
            const { subject, pointsToAdd, metrics } = req.body;
            if (!subject) return res.status(400).json({ error: 'Subject is required' });

            const data = readData();
            if (!data.progress[subject]) {
                data.progress[subject] = { level: 1, points: 0, history: [] };
            }

            const p = data.progress[subject];
            p.points = (p.points || 0) + (parseInt(pointsToAdd) || 0);

            // Level up logic (every 100 points = 1 level)
            const newLevel = Math.floor(p.points / 100) + 1;
            const leveledUp = newLevel > (p.level || 1);
            p.level = newLevel;

            // Handle specific subject metrics
            if (subject === 'typing' && metrics?.wpm) {
                p.best_wpm = Math.max(p.best_wpm || 0, metrics.wpm);
            }
            if (subject === 'math' && metrics?.score) {
                p.best_score = Math.max(p.best_score || 0, metrics.score);
            }

            p.history.push({
                timestamp: new Date().toISOString(),
                points_added: pointsToAdd,
                metrics: metrics || {}
            });

            writeData(data);
            return res.json({ success: true, progress: p, leveledUp });
        }

        // 4. COMPLETE QUEST
        if (req.method === 'POST' && action === 'complete_quest') {
            const { questId } = req.body;
            if (!questId) return res.status(400).json({ error: 'Quest ID is required' });

            const data = readData();
            const quest = data.quests.find(q => q.id === questId);
            if (!quest) return res.status(404).json({ error: 'Quest not found' });

            if (quest.completed) {
                return res.json({ success: true, message: 'Quest already completed', quest });
            }

            quest.completed = true;
            quest.completed_at = new Date().toISOString();

            // Reward points to the subject
            const subject = quest.subject;
            if (!data.progress[subject]) {
                data.progress[subject] = { level: 1, points: 0, history: [] };
            }
            const p = data.progress[subject];
            p.points = (p.points || 0) + (quest.points || 20);
            
            // Level up logic
            p.level = Math.floor(p.points / 100) + 1;

            p.history.push({
                timestamp: new Date().toISOString(),
                points_added: quest.points,
                quest_completed: questId
            });

            writeData(data);
            return res.json({ success: true, quest, progress: p });
        }

        // 4.5. ADD NEW QUEST
        if (req.method === 'POST' && action === 'add_quest') {
            const { id, title, description, subject, points } = req.body;
            if (!id || !title || !subject) {
                return res.status(400).json({ error: 'Missing required quest fields' });
            }

            const data = readData();
            if (data.quests.some(q => q.id === id)) {
                return res.status(400).json({ error: 'Quest ID already exists' });
            }

            const newQuest = {
                id,
                title,
                description: description || "",
                subject,
                points: parseInt(points) || 20,
                completed: false
            };

            data.quests.push(newQuest);
            writeData(data);
            return res.json({ success: true, quest: newQuest });
        }

        // 5. CHAT WITH AI COMPANION
        if (req.method === 'POST' && action === 'chat') {
            const { message, history } = req.body;
            if (!message) return res.status(400).json({ error: 'Message required' });

            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (!geminiApiKey) {
                return res.status(500).json({ error: 'Gemini API key is not configured' });
            }

            const systemInstruction = 
                "You are Sparky, a friendly, warm, and highly engaging AI learning companion for a child. " +
                "You speak in a clean, encouraging tone. Keep your responses simple, fun, and concise " +
                "(no more than 3 sentences or a quick bulleted list). Focus on helping them learn to read, write, " +
                "spell, do math, and think creatively. You can include child-friendly emojis like 🚀, 🧠, 🎨, 🌟.";

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

            // Build conversation payload
            const contents = [];
            
            // Add conversation history if provided
            if (Array.isArray(history)) {
                history.forEach(turn => {
                    contents.push({
                        role: turn.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: turn.text }]
                    });
                });
            }

            // Append current user message
            contents.push({
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\nChild's Message: "${message}"\nSparky's Response:` }]
            });

            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'identity'
                },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        maxOutputTokens: 250,
                        temperature: 0.7
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[Academy API] Gemini API Error:", errorText);
                return res.status(502).json({ error: 'Failed to communicate with AI model' });
            }

            const geminiData = await response.json();
            const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "¡Hola! Soy Sparky. ¿Qué te gustaría aprender hoy?";
            return res.json({ reply: replyText.trim() });
        }

        // 6. GENERATE AI STORY
        if (req.method === 'POST' && action === 'story') {
            const { promptText } = req.body;
            if (!promptText) return res.status(400).json({ error: 'Prompt is required' });

            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (!geminiApiKey) {
                return res.status(500).json({ error: 'Gemini API key is not configured' });
            }

            const storyInstruction = 
                "Write a short, engaging story for a 6-year old child based on their idea: \"" + promptText + "\". " +
                "The story must be exactly 3 to 4 pages long. Each page must be a short paragraph of 2-3 simple, clean sentences using easy words for a first grader to practice reading. " +
                "Format the output strictly as a JSON object with: " +
                "{\n  \"title\": \"Story Title\",\n  \"pages\": [\n    \"Page 1 text...\",\n    \"Page 2 text...\",\n    \"Page 3 text...\"\n  ]\n}";

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'identity'
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: storyInstruction }]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        maxOutputTokens: 500,
                        temperature: 0.8
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[Academy API] Gemini Story API Error:", errorText);
                return res.status(502).json({ error: 'Failed to generate story' });
            }

            const geminiData = await response.json();
            const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            
            try {
                const parsed = JSON.parse(textResponse);
                return res.json(parsed);
            } catch (err) {
                console.error("[Academy API] Story JSON Parse Error:", textResponse);
                return res.status(500).json({ error: 'Generated story was not in correct JSON format' });
            }
        }

        return res.status(404).json({ error: 'Action not found' });
    } catch (e) {
        console.error("[Academy API] Error handling request:", e);
        return res.status(500).json({ error: e.message });
    }
};
