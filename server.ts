import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongoClient: MongoClient | null = null;

async function getMongoDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }
  if (!mongoClient) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    mongoClient = client;
    console.log("Lazily connected to MongoDB database.");
  }

  try {
    // Ping DB to confirm the connection is active and whitelisted
    await mongoClient.db().command({ ping: 1 });
  } catch (err) {
    console.warn("MongoDB client ping failed, resetting connection...", err);
    try {
      await mongoClient.close();
    } catch (_) {}
    mongoClient = null;
    throw err;
  }

  return mongoClient.db();
}

export const app = express();
const PORT = 3000;

// Vercel path-rewrite normalization middleware
app.use((req, res, next) => {
  if (process.env.VERCEL && !req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));



  // AI Proxy Route
  app.post('/api/ai/generate', async (req, res) => {
    const { prompt, systemInstruction, model } = req.body;
    const rawKeys = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEYS || "";
    const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (apiKeys.length === 0) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set in the server environment.' });
    }

    const isRetryableError = (error: any) => {
      const msg = error?.message?.toLowerCase() || "";
      const status = error?.status || error?.code || 500;
      return msg.includes("quota") || msg.includes("429") || msg.includes("high demand") || 
             msg.includes("unavailable") || status === 429 || status === 503;
    };

    for (let i = 0; i < apiKeys.length; i++) {
        let retries = 2;
        const currentKey = apiKeys[i];
        
        while (retries >= 0) {
            try {
                const ai = new GoogleGenAI({ apiKey: currentKey });
                const response = await ai.models.generateContent({
                  model: model || 'gemini-3-flash-preview',
                  contents: prompt,
                  config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.7,
                  }
                });

                return res.json({ text: response.text });
            } catch (error: any) {
                if (isRetryableError(error)) {
                    if (retries > 0) {
                        console.warn(`Server AI Proxy: Retryable error on key #${i+1}, retries left: ${retries}`);
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        continue;
                    } else if (i < apiKeys.length - 1) {
                        console.warn(`Server AI Proxy: Key #${i+1} failed after retries. Rotating...`);
                        break; // Exit while, move to next key in for loop
                    }
                }
                
                // If it's the last key and last retry, or not retryable
                if (i === apiKeys.length - 1 && (retries <= 0 || !isRetryableError(error))) {
                    console.error('AI Proxy Final Error:', error);
                    return res.status(500).json({ error: error.message });
                }
                
                if (!isRetryableError(error)) {
                     return res.status(500).json({ error: error.message });
                }
                break; // move to next key
            }
        }
    }
  });

  // ==========================================
  // MongoDB Real-time Sync API Routes
  // ==========================================
  
  // 1. Connection Status Checking
  app.get('/api/mongodb/status', async (req, res) => {
    try {
      const uri = process.env.MONGODB_URI;
      if (!uri) {
        return res.json({ configured: false, connected: false, error: "MONGODB_URI is absent from environment variables." });
      }
      await getMongoDb();
      res.json({ configured: true, connected: true, error: null });
    } catch (err: any) {
      res.json({ configured: true, connected: false, error: err.message || String(err) });
    }
  });

  // 2. Load Full App Data Structure
  app.get('/api/mongodb/data', async (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId parameter is required' });
    }
    try {
      const db = await getMongoDb();

      // Parallel reads for optimal performance
      const [
        userRecord,
        studentsList,
        habitsList,
        expensesList,
        journalList,
        attendanceList,
        dpssTopicsList,
        selfLearningTopicsList,
        habitCompletionsList,
        dailyNotesList
      ] = await Promise.all([
        db.collection<any>('users').findOne({ _id: userId }),
        db.collection('students').find({ userId }).toArray(),
        db.collection('habits').find({ userId }).toArray(),
        db.collection('expenses').find({ userId }).toArray(),
        db.collection('journal').find({ userId }).toArray(),
        db.collection('attendance').find({ userId }).toArray(),
        db.collection('dpss_topics').find({ userId }).toArray(),
        db.collection('self_learning_topics').find({ userId }).toArray(),
        db.collection('habit_completions').find({ userId }).toArray(),
        db.collection('daily_notes').find({ userId }).toArray()
      ]);

      // Map Document lists back into Firebase-compatible key-value record maps
      const journalEntries: Record<string, any> = {};
      journalList.forEach(d => {
        const { _id, userId: _, ...entry } = d;
        journalEntries[d.id] = entry;
      });

      const attendance: Record<string, any> = {};
      attendanceList.forEach(d => {
        const { _id, id, userId: _, ...other } = d;
        attendance[d.id] = d.data || other;
      });

      const habitCompletions: Record<string, any> = {};
      habitCompletionsList.forEach(d => {
        const { _id, id, userId: _, ...other } = d;
        habitCompletions[d.id] = d.completions || other;
      });

      const dailyNotes: Record<string, any> = {};
      dailyNotesList.forEach(d => {
        dailyNotes[d.id] = d.content || "";
      });

      // Default settings fallback
      const defaultSettings = {
        fontSize: 12,
        fontFamily: "'Inter', sans-serif",
        textFontFamily: "'Inter', sans-serif",
        textFontSize: 16,
        backgroundImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=2000'
      };

      const compiledData = {
        settings: userRecord?.settings || defaultSettings,
        students: studentsList.map(({ _id, userId: _, ...s }) => s),
        habits: habitsList.map(({ _id, userId: _, ...h }) => h),
        expenses: expensesList.map(({ _id, userId: _, ...e }) => e),
        journalEntries,
        attendance,
        dpssTopics: dpssTopicsList.map(({ _id, userId: _, ...t }) => t),
        selfLearningTopics: selfLearningTopicsList.map(({ _id, userId: _, ...t }) => t),
        habitCompletions,
        dailyNotes
      };

      res.json(compiledData);
    } catch (err: any) {
      console.warn("MongoDB Load Error - falling back:", err.message);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // 3. Save Settings
  app.post('/api/mongodb/save', async (req, res) => {
    const { userId, settings } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    try {
      const db = await getMongoDb();
      await db.collection('users').updateOne(
        { _id: userId },
        { $set: { settings, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Save Student record
  app.post('/api/mongodb/student', async (req, res) => {
    const { userId, student } = req.body;
    if (!userId || !student?.id) return res.status(400).json({ error: 'userId and student.id are required' });
    try {
      const db = await getMongoDb();
      await db.collection('students').updateOne(
        { userId, id: student.id },
        { $set: { ...student, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Delete Student record
  app.delete('/api/mongodb/student', async (req, res) => {
    const { userId, id } = req.body;
    if (!userId || !id) return res.status(400).json({ error: 'userId and student.id are required' });
    try {
      const db = await getMongoDb();
      await db.collection('students').deleteOne({ userId, id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Save Attendance record
  app.post('/api/mongodb/attendance', async (req, res) => {
    const { userId, date, data } = req.body;
    if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });
    try {
      const db = await getMongoDb();
      await db.collection('attendance').updateOne(
        { userId, id: date },
        { $set: { data, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Save / Delete Expense
  app.post('/api/mongodb/expense', async (req, res) => {
    const { userId, expense, isDelete } = req.body;
    if (!userId || !expense?.id) return res.status(400).json({ error: 'userId and expense.id are required' });
    try {
      const db = await getMongoDb();
      if (isDelete) {
        await db.collection('expenses').deleteOne({ userId, id: expense.id });
      } else {
        await db.collection('expenses').updateOne(
          { userId, id: expense.id },
          { $set: { ...expense, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Save Journal Entry
  app.post('/api/mongodb/journal', async (req, res) => {
    const { userId, date, entry } = req.body;
    if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });
    try {
      const db = await getMongoDb();
      await db.collection('journal').updateOne(
        { userId, id: date },
        { $set: { ...entry, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Save DPSS / Self Learning Topic
  app.post('/api/mongodb/topic', async (req, res) => {
    const { userId, topic, category } = req.body;
    if (!userId || !topic?.id) return res.status(400).json({ error: 'userId and topic.id are required' });
    const coll = category === 'dpss' ? 'dpss_topics' : 'self_learning_topics';
    try {
      const db = await getMongoDb();
      await db.collection(coll).updateOne(
        { userId, id: topic.id },
        { $set: { ...topic, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Delete DPSS / Self Learning Topic
  app.delete('/api/mongodb/topic', async (req, res) => {
    const { userId, id, category } = req.body;
    if (!userId || !id) return res.status(400).json({ error: 'userId and id are required' });
    const coll = category === 'dpss' ? 'dpss_topics' : 'self_learning_topics';
    try {
      const db = await getMongoDb();
      await db.collection(coll).deleteOne({ userId, id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Bulk Topics saving (efficient)
  app.post('/api/mongodb/topics-bulk', async (req, res) => {
    const { userId, topicsToSave, topicIdsToDelete } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    try {
      const db = await getMongoDb();
      
      const bulkOps: Record<string, any[]> = {
        dpss_topics: [],
        self_learning_topics: []
      };

      topicsToSave?.forEach(({ topic, category }: any) => {
        const coll = category === 'dpss' ? 'dpss_topics' : 'self_learning_topics';
        bulkOps[coll].push({
          updateOne: {
            filter: { userId, id: topic.id },
            update: { $set: { ...topic, updatedAt: new Date().toISOString() } },
            upsert: true
          }
        });
      });

      topicIdsToDelete?.forEach(({ id, category }: any) => {
        const coll = category === 'dpss' ? 'dpss_topics' : 'self_learning_topics';
        bulkOps[coll].push({
          deleteOne: {
            filter: { userId, id }
          }
        });
      });

      await Promise.all([
        bulkOps.dpss_topics.length > 0 ? db.collection('dpss_topics').bulkWrite(bulkOps.dpss_topics) : Promise.resolve(),
        bulkOps.self_learning_topics.length > 0 ? db.collection('self_learning_topics').bulkWrite(bulkOps.self_learning_topics) : Promise.resolve(),
      ]);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Save Daily Notes content
  app.post('/api/mongodb/daily-note', async (req, res) => {
    const { userId, date, content } = req.body;
    if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });
    try {
      const db = await getMongoDb();
      await db.collection('daily_notes').updateOne(
        { userId, id: date },
        { $set: { content, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. Save Habits list
  app.post('/api/mongodb/habits', async (req, res) => {
    const { userId, habits } = req.body;
    if (!userId || !Array.isArray(habits)) return res.status(400).json({ error: 'userId and habits array are required' });
    try {
      if (habits.length === 0) return res.json({ success: true });
      const db = await getMongoDb();
      const operations = habits.map((h: any) => ({
        updateOne: {
          filter: { userId, id: h.id },
          update: { $set: { ...h, updatedAt: new Date().toISOString() } },
          upsert: true
        }
      }));
      await db.collection('habits').bulkWrite(operations);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. Delete Habit record
  app.delete('/api/mongodb/habit', async (req, res) => {
    const { userId, id } = req.body;
    if (!userId || !id) return res.status(400).json({ error: 'userId and habit.id are required' });
    try {
      const db = await getMongoDb();
      await db.collection('habits').deleteOne({ userId, id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. Save Habits completions
  app.post('/api/mongodb/habit-completion', async (req, res) => {
    const { userId, date, completions } = req.body;
    if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });
    try {
      const db = await getMongoDb();
      await db.collection('habit_completions').updateOne(
        { userId, id: date },
        { $set: { completions, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16. Share document metadata (supports offline compilation)
  app.post('/api/mongodb/share', async (req, res) => {
    const { shareId, metadata } = req.body;
    if (!shareId || !metadata) return res.status(400).json({ error: 'shareId and metadata are required' });
    try {
      const db = await getMongoDb();
      await db.collection('shared_notes').updateOne(
        { _id: shareId },
        { $set: { ...metadata, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 17. Load shared element
  app.get('/api/mongodb/share/:shareId', async (req, res) => {
    const { shareId } = req.params;
    try {
      const db = await getMongoDb();
      const note = await db.collection<any>('shared_notes').findOne({ _id: shareId });
      if (!note) {
        return res.status(404).json({ error: 'Shared content has expired or is invalid.' });
      }
      res.json(note);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite Middleware
  async function startServer() {
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    if (!process.env.VERCEL) {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
      });
    }
  }

  startServer();
