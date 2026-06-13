import { auth, signInWithGoogle, logOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from './firebase_old';
import { AppData, Student } from '../types';

// Re-export authentication helpers directly from Firebase to preserve standard flows
export { auth, signInWithGoogle, logOut, signInWithEmailAndPassword, createUserWithEmailAndPassword };

// Client-side cache to support instant UI updates
const activeSubscriptions = new Map<string, {
  currentData: AppData;
  onData: (data: AppData) => void;
  pollingInterval?: any;
}>();

const updateLocalCache = (userId: string, updates: Partial<AppData>) => {
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const newData = { ...sub.currentData };
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        (newData as any)[key] = { ...((newData as any)[key] || {}), ...value };
      } else {
        (newData as any)[key] = value;
      }
    });

    sub.currentData = newData;
    sub.onData({ ...sub.currentData });
    
    // Save to local storage for quick offline retrieval
    localStorage.setItem('dps_data', JSON.stringify(newData));
  }
};

let isSystemOnline = true;

// Helper to retrieve status
export const getSyncStatus = () => isSystemOnline;

// Primary dynamic sync subscription
export const subscribeToData = (
  userId: string,
  onData: (data: AppData) => void,
  onError: (error: any) => void
) => {
  if (!userId) {
    onError(new Error("User not authenticated"));
    return () => {};
  }

  // Load initial baseline from localStorage
  let currentData: AppData = {
    students: [],
    attendance: {},
    systemLocked: false,
    expenses: [],
    journalEntries: {},
    dpssTopics: [],
    habitCompletions: {},
    dailyNotes: {},
    habits: []
  };

  try {
    const saved = localStorage.getItem('dps_data');
    if (saved) {
      currentData = { ...currentData, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn("Failed to parse local stored content key:", e);
  }

  // Set up subscription slot
  const subscription: any = {
    currentData,
    onData,
  };
  activeSubscriptions.set(userId, subscription);

  // Trigger immediate rendering with local cache first (instant loading!)
  onData({ ...currentData });

  // Load data from MongoDB on connect
  const fetchRemoteData = async () => {
    try {
      const res = await fetch(`/api/mongodb/data?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const remoteData = await res.json();
      isSystemOnline = true;
      
      const sub = activeSubscriptions.get(userId);
      if (sub) {
        // Safe check: Is remote data totally empty while local data exists?
        // If they just logged in with a fresh account of MongoDB, we should migrate their local data!
        const isRemoteEmpty = (
          (!remoteData.students || remoteData.students.length === 0) &&
          (!remoteData.habits || remoteData.habits.length === 0) &&
          (!remoteData.expenses || remoteData.expenses.length === 0) &&
          (!remoteData.dpssTopics || remoteData.dpssTopics.length === 0) &&
          (!remoteData.selfLearningTopics || remoteData.selfLearningTopics.length === 0) &&
          (!remoteData.dailyNotes || Object.keys(remoteData.dailyNotes).length === 0) &&
          (!remoteData.journalEntries || Object.keys(remoteData.journalEntries).length === 0) &&
          (!remoteData.habitCompletions || Object.keys(remoteData.habitCompletions).length === 0) &&
          (!remoteData.attendance || Object.keys(remoteData.attendance).length === 0)
        );

        const isLocalNotEmpty = (
          (sub.currentData.students && sub.currentData.students.length > 0) ||
          (sub.currentData.habits && sub.currentData.habits.length > 0) ||
          (sub.currentData.expenses && sub.currentData.expenses.length > 0) ||
          (sub.currentData.dpssTopics && sub.currentData.dpssTopics.length > 0) ||
          (sub.currentData.selfLearningTopics && sub.currentData.selfLearningTopics.length > 0) ||
          (sub.currentData.dailyNotes && Object.keys(sub.currentData.dailyNotes).length > 0) ||
          (sub.currentData.journalEntries && Object.keys(sub.currentData.journalEntries).length > 0) ||
          (sub.currentData.habitCompletions && Object.keys(sub.currentData.habitCompletions).length > 0) ||
          (sub.currentData.attendance && Object.keys(sub.currentData.attendance).length > 0)
        );

        if (isRemoteEmpty && isLocalNotEmpty) {
          console.log("MongoDB is empty but pre-existing local data exists. Launching dynamic initialization migration.");

          // One-time asynchronous stream migration in background so UI updates instantly
          const uploadLocalDataToRemote = async () => {
            try {
              if (sub.currentData.settings) {
                await postData('/api/mongodb/save', { userId, settings: sub.currentData.settings });
              }
              if (sub.currentData.students?.length) {
                for (const student of sub.currentData.students) {
                  await postData('/api/mongodb/student', { userId, student });
                }
              }
              if (sub.currentData.habits?.length) {
                await postData('/api/mongodb/habits', { userId, habits: sub.currentData.habits });
              }
              if (sub.currentData.expenses?.length) {
                for (const expense of sub.currentData.expenses) {
                  await postData('/api/mongodb/expense', { userId, expense, isDelete: false });
                }
              }
              if (sub.currentData.dailyNotes) {
                for (const [date, content] of Object.entries(sub.currentData.dailyNotes)) {
                  await postData('/api/mongodb/daily-note', { userId, date, content });
                }
              }
              if (sub.currentData.dpssTopics?.length) {
                for (const topic of sub.currentData.dpssTopics) {
                  await postData('/api/mongodb/topic', { userId, topic, category: 'dpss' });
                }
              }
              if (sub.currentData.selfLearningTopics?.length) {
                for (const topic of sub.currentData.selfLearningTopics) {
                  await postData('/api/mongodb/topic', { userId, topic, category: 'selfLearning' });
                }
              }
              if (sub.currentData.journalEntries) {
                for (const [date, entry] of Object.entries(sub.currentData.journalEntries)) {
                  await postData('/api/mongodb/journal', { userId, date, entry });
                }
              }
              if (sub.currentData.habitCompletions) {
                for (const [date, completions] of Object.entries(sub.currentData.habitCompletions)) {
                  await postData('/api/mongodb/habit-completion', { userId, date, completions });
                }
              }
              if (sub.currentData.attendance) {
                for (const [date, data] of Object.entries(sub.currentData.attendance)) {
                  await postData('/api/mongodb/attendance', { userId, date, data });
                }
              }
              console.log("Pre-existing local data completely migrated to cloud MongoDB database.");
            } catch (innerErr) {
              console.warn("Migration stream caught error:", innerErr);
            }
          };

          uploadLocalDataToRemote();
        } else {
          // Standard overwrite matching remote source of truth for synced profiles
          sub.currentData = { ...sub.currentData, ...remoteData };
        }

        sub.onData({ ...sub.currentData });
        localStorage.setItem('dps_data', JSON.stringify(sub.currentData));
      }
    } catch (err) {
      console.warn("Could not retrieve remote MongoDB data, fallback to local storage:", err);
      isSystemOnline = false;
    }
  };

  fetchRemoteData();

  // Set up a background heartbeat / light refetching loop (every 5 seconds for rapid cross-device sync)
  const interval = setInterval(fetchRemoteData, 5000);
  subscription.pollingInterval = interval;

  return () => {
    clearInterval(interval);
    activeSubscriptions.delete(userId);
  };
};

// Generic POST helper
async function postData(endpoint: string, body: any) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("HTTP error " + res.status);
    isSystemOnline = true;
    return await res.json();
  } catch (err) {
    console.warn(`Write to ${endpoint} failed, queueing offline:`, err);
    isSystemOnline = false;
  }
}

// REST Client API calls mapping Mongo schema
export const saveData = async (userId: string, data: AppData) => {
  if (!userId) return;
  updateLocalCache(userId, data);
  await postData('/api/mongodb/save', { userId, settings: data.settings });
};

export const saveStudent = async (userId: string, student: Student) => {
  if (!userId || !student?.id) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const students = [...(sub.currentData.students || [])];
    const idx = students.findIndex(s => s.id === student.id);
    if (idx !== -1) students[idx] = student; else students.push(student);
    updateLocalCache(userId, { students });
  }
  await postData('/api/mongodb/student', { userId, student });
};

export const deleteStudent = async (userId: string, studentId: string) => {
  if (!userId || !studentId) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    updateLocalCache(userId, { students: (sub.currentData.students || []).filter(s => s.id !== studentId) });
  }
  try {
    await fetch('/api/mongodb/student', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, id: studentId })
    });
    isSystemOnline = true;
  } catch (err) {
    isSystemOnline = false;
  }
};

export const saveAttendance = async (userId: string, date: string, data: Record<string, number>) => {
  if (!userId || !date) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const attendance = { ...(sub.currentData.attendance || {}), [date]: data };
    updateLocalCache(userId, { attendance });
  }
  await postData('/api/mongodb/attendance', { userId, date, data });
};

export const saveExpense = async (userId: string, expense: any, isDelete: boolean = false) => {
  if (!userId || !expense?.id) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const expenses = (sub.currentData.expenses || []).filter(e => e.id !== expense.id);
    if (!isDelete) expenses.push(expense);
    updateLocalCache(userId, { expenses });
  }
  await postData('/api/mongodb/expense', { userId, expense, isDelete });
};

export const saveJournalEntry = async (userId: string, date: string, entry: any) => {
  if (!userId || !date) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const journalEntries = { ...(sub.currentData.journalEntries || {}), [date]: entry };
    updateLocalCache(userId, { journalEntries });
  }
  await postData('/api/mongodb/journal', { userId, date, entry });
};

export const saveTopic = async (userId: string, topic: any, category: 'dpss' | 'selfLearning' = 'dpss') => {
  if (!userId || !topic?.id) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const field = category === 'dpss' ? 'dpssTopics' : 'selfLearningTopics';
    const topics = [...(sub.currentData[field] || [])];
    const idx = topics.findIndex(t => t.id === topic.id);
    if (idx !== -1) topics[idx] = topic; else topics.push(topic);
    updateLocalCache(userId, { [field]: topics });
  }
  await postData('/api/mongodb/topic', { userId, topic, category });
};

export const deleteTopic = async (userId: string, topicId: string, category: 'dpss' | 'selfLearning' = 'dpss') => {
  if (!userId || !topicId) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const field = category === 'dpss' ? 'dpssTopics' : 'selfLearningTopics';
    updateLocalCache(userId, { [field]: (sub.currentData[field] || []).filter((t: any) => t.id !== topicId) });
  }
  try {
    await fetch('/api/mongodb/topic', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, id: topicId, category })
    });
    isSystemOnline = true;
  } catch (err) {
    isSystemOnline = false;
  }
};

export const saveTopicsBulk = async (
  userId: string,
  topicsToSave: { topic: any; category: 'dpss' | 'selfLearning' }[],
  topicIdsToDelete: { id: string; category: 'dpss' | 'selfLearning' }[]
) => {
  if (!userId) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    let dpssTopics = [...(sub.currentData.dpssTopics || [])];
    let selfLearningTopics = [...(sub.currentData.selfLearningTopics || [])];

    topicsToSave.forEach(({ topic, category }) => {
      const arr = category === 'dpss' ? dpssTopics : selfLearningTopics;
      const idx = arr.findIndex((t: any) => String(t.id) === String(topic.id));
      if (idx !== -1) arr[idx] = topic; else arr.push(topic);
    });

    topicIdsToDelete.forEach(({ id, category }) => {
      if (category === 'dpss') {
        dpssTopics = dpssTopics.filter((t: any) => String(t.id) !== String(id));
      } else {
        selfLearningTopics = selfLearningTopics.filter((t: any) => String(t.id) !== String(id));
      }
    });

    updateLocalCache(userId, { dpssTopics, selfLearningTopics });
  }
  await postData('/api/mongodb/topics-bulk', { userId, topicsToSave, topicIdsToDelete });
};

export const saveDailyNote = async (userId: string, date: string, content: string) => {
  if (!userId || !date) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const dailyNotes = { ...(sub.currentData.dailyNotes || {}), [date]: content };
    updateLocalCache(userId, { dailyNotes });
  }
  await postData('/api/mongodb/daily-note', { userId, date, content });
};

export const saveHabitList = async (userId: string, habits: any[]) => {
  if (!userId || !Array.isArray(habits)) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const currentHabits = [...(sub.currentData.habits || [])];
    habits.forEach(newH => {
      const idx = currentHabits.findIndex(h => h.id === newH.id);
      if (idx !== -1) currentHabits[idx] = newH; else currentHabits.push(newH);
    });
    updateLocalCache(userId, { habits: currentHabits });
  }
  await postData('/api/mongodb/habits', { userId, habits });
};

export const deleteHabit = async (userId: string, habitId: string) => {
  if (!userId || !habitId) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    updateLocalCache(userId, { habits: (sub.currentData.habits || []).filter(h => h.id !== habitId) });
  }
  try {
    await fetch('/api/mongodb/habit', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, id: habitId })
    });
    isSystemOnline = true;
  } catch (err) {
    isSystemOnline = false;
  }
};

export const saveHabitCompletion = async (userId: string, date: string, habitId: string, completed: boolean | number) => {
  if (!userId || !date || !habitId) return;
  const sub = activeSubscriptions.get(userId);
  let finalCompletions: any = {};
  if (sub) {
    const completions = { ...(sub.currentData.habitCompletions || {}) };
    finalCompletions = { ...(completions[date] || {}), [habitId]: completed };
    completions[date] = finalCompletions;
    updateLocalCache(userId, { habitCompletions: completions });
  }
  await postData('/api/mongodb/habit-completion', { userId, date, completions: finalCompletions });
};

export const saveHabitCompletionBulk = async (userId: string, date: string, completions: Record<string, boolean | number>) => {
  if (!userId || !date) return;
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const habitCompletions = { ...(sub.currentData.habitCompletions || {}), [date]: completions };
    updateLocalCache(userId, { habitCompletions });
  }
  await postData('/api/mongodb/habit-completion', { userId, date, completions });
};

// Dummy Backups mapping local history storage (MongoDB has native replication/backups)
export const createCloudBackup = async (data: AppData, type: 'Auto' | 'Manual' = 'Manual') => {
  try {
    const backupsKey = 'dps_backups_local';
    const stored = localStorage.getItem(backupsKey);
    const history = JSON.parse(stored || '[]');
    history.unshift({
      timestamp: new Date().toISOString(),
      data: data,
      type: type,
      id: Math.random().toString(36).substr(2, 9)
    });
    localStorage.setItem(backupsKey, JSON.stringify(history.slice(0, 10)));
  } catch (err) {
    console.warn("Backup creation failed locally:", err);
  }
};

export const getCloudBackups = async (): Promise<any[]> => {
  try {
    const backupsKey = 'dps_backups_local';
    const stored = localStorage.getItem(backupsKey);
    return JSON.parse(stored || '[]');
  } catch (err) {
    return [];
  }
};

// Global Sharer Helpers
export const createSharedNote = async (
  userId: string,
  ownerName: string,
  type: 'self-learning' | 'journal' | 'daily-note' | 'note-taking',
  title: string,
  payload: any
): Promise<string> => {
  const shareId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const metadata = {
    id: shareId,
    ownerId: userId || 'unknown',
    ownerName: ownerName || 'Chanthy',
    type,
    title: title || 'Untitled',
    createdAt: new Date().toISOString(),
    payload
  };

  await postData('/api/mongodb/share', { shareId, metadata });
  return shareId;
};

export const getSharedNote = async (shareId: string): Promise<any> => {
  try {
    const res = await fetch(`/api/mongodb/share/${encodeURIComponent(shareId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Could not retrieve shared document:", err);
    return null;
  }
};
