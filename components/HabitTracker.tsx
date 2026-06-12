import React, { useState, useEffect, useMemo } from 'react';
import { RichTextDiv } from './FloatingToolbar';
import { AppData, Habit, HabitCompletion } from '../types';
import { CheckSquare, ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, Zap, Maximize2, Minimize2, Calendar as CalendarIcon, Edit3, Target, Wand2, RefreshCw, X, Download, MessageSquare, Eye, EyeOff, Pin, PinOff, Share2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, subDays, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { VariableSizeList as List } from 'react-window';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import html2pdf from 'html2pdf.js';
import { callNeuralEngine } from '../services/neuralEngine';
import { ConfettiOverlay } from './ConfettiOverlay';

const AMBIENT_WALLPAPERS = [
  { name: 'Beach Sunset', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Aurora Borealis', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Cyber Grid', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Minimal Slate', url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Calming Mist', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Abstract Flow', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Cosmic Nebula', url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&q=80&w=2000' }
];

export const HABIT_COLORS = [
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Sky Blue', hex: '#0ea5e9' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Fuchsia', hex: '#d946ef' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Crimson', hex: '#ef4444' },
  { name: 'Charcoal', hex: '#475569' }
];

interface HabitTrackerProps {
  data: AppData;
  onUpdate: (newDataOrUpdater: AppData | ((prev: AppData) => AppData)) => void;
  onUpdateHabitCompletion?: (date: string, habitId: string, completed: boolean | number) => void;
  onUpdateDailyNote?: (date: string, content: string) => void;
}

export const HabitTracker: React.FC<HabitTrackerProps> = ({ data, onUpdate, onUpdateHabitCompletion, onUpdateDailyNote }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPlanningDate, setSelectedPlanningDate] = useState(new Date());
  const [streakMilestoneEvent, setStreakMilestoneEvent] = useState<{streak: number, habitName: string} | null>(null);
  const [newHabitCategory, setNewHabitCategory] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [isResettingWeek, setIsResettingWeek] = useState(false);
  const [resetTargetCategory, setResetTargetCategory] = useState('General');
  const [newHabitName, setNewHabitName] = useState('');
  const [isNumericHabit, setIsNumericHabit] = useState(false);
  const [habitTargetValue, setHabitTargetValue] = useState<number>(2);
  const [habitUnit, setHabitUnit] = useState<string>('liters');
  const [habitColor, setHabitColor] = useState<string>('#ea580c');
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [suggestedHabits, setSuggestedHabits] = useState<string[]>([]);
  const [milestoneCelebration, setMilestoneCelebration] = useState<{ habitName: string; color: string; streak: number } | null>(null);

  const [isDisciplinesFrozen, setIsDisciplinesFrozen] = useState(true);
  const [disciplinesWidth, setDisciplinesWidth] = useState(() => {
    const saved = localStorage.getItem('gportal_discipline_sidebar_width');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 160 && parsed <= 600) {
        return parsed;
      }
    }
    return 380;
  });

  useEffect(() => {
    localStorage.setItem('gportal_discipline_sidebar_width', disciplinesWidth.toString());
  }, [disciplinesWidth]);
  const [isResizing, setIsResizing] = useState(false);

  const startResizeX = React.useRef(0);
  const startWidth = React.useRef(0);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startResizeX.current = e.clientX;
    startWidth.current = disciplinesWidth;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsResizing(true);
    if (e.touches.length > 0) {
      startResizeX.current = e.touches[0].clientX;
      startWidth.current = disciplinesWidth;
    }
  };

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startResizeX.current;
      const newWidth = Math.max(160, Math.min(600, startWidth.current + deltaX));
      setDisciplinesWidth(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const deltaX = e.touches[0].clientX - startResizeX.current;
        const newWidth = Math.max(160, Math.min(600, startWidth.current + deltaX));
        setDisciplinesWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing]);

  const [editingNoteState, setEditingNoteState] = useState<{
    habitId: string;
    habitName: string;
    habitColor?: string;
    date: string;
    noteText: string;
  } | null>(null);

  // Note sharing states
  const [isSharingNote, setIsSharingNote] = useState(false);
  const [generatedShareLink, setGeneratedShareLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleShareNote = async () => {
    setIsSharingNote(true);
    const dateKey = format(selectedPlanningDate, 'yyyy-MM-dd');
    const noteContent = notes[dateKey] || '';
    try {
      const { createSharedNote } = await import('../services/firebase');
      const storedUser = localStorage.getItem('dps_user');
      let userName = 'Chanthy';
      let userId = 'unknown';
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          userName = u.name || 'Chanthy';
          userId = u.uid || 'unknown';
        } catch(e){}
      }
      
      const shareId = await createSharedNote(
        userId,
        userName,
        'daily-note',
        `Daily Note: ${format(selectedPlanningDate, 'MMM d, yyyy')}`,
        { date: dateKey, content: noteContent }
      );
      
      const link = window.location.origin + window.location.pathname + '?share=' + shareId;
      setGeneratedShareLink(link);
    } catch (error: any) {
      console.error(error);
      alert(`Failed to generate shared link: ${error?.message || error || 'Unknown error'}`);
    } finally {
      setIsSharingNote(false);
    }
  };

  const openNoteDialog = (habit: Habit, dateStr: string) => {
    const existingNote = data.habitNotes?.[dateStr]?.[habit.id] || '';
    setEditingNoteState({
      habitId: habit.id,
      habitName: habit.name,
      habitColor: habit.color,
      date: dateStr,
      noteText: existingNote
    });
  };

  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // Auto request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Ensure scroll is positioned at today on mount or month change
  useEffect(() => {
    if (tableContainerRef.current && !isFullScreen) {
      setTimeout(() => {
        const todayCell = tableContainerRef.current?.querySelector('.today-cell');
        if (todayCell && tableContainerRef.current) {
          const scrollLeft = (todayCell as HTMLElement).offsetLeft - 120;
          tableContainerRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
      }, 100);
    }
  }, [currentDate, isFullScreen]);


  const habits = data.habits || [];
  const completions = data.habitCompletions || {};
  const notes = data.dailyNotes || {}; 

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const calculateStreakWithCompletions = (habitId: string, customCompletions: any) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return 0;
    
    let currentStreak = 0;
    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    const yesterdayKey = format(subDays(today, 1), 'yyyy-MM-dd');
    
    const isCompletedOnDay = (dateStr: string) => {
      const comp = customCompletions[dateStr]?.[habitId];
      if (comp === undefined || comp === null) return false;
      if (habit.isNumeric) {
        return typeof comp === 'number' ? comp >= (habit.targetValue || 0) : !!comp;
      }
      return !!comp;
    };

    let dateToCheck = today;
    if (!isCompletedOnDay(todayKey)) {
      if (!isCompletedOnDay(yesterdayKey)) return 0;
      dateToCheck = subDays(today, 1);
    }
    
    let safetyLimit = 1000;
    while (safetyLimit > 0) {
      safetyLimit--;
      const dateKey = format(dateToCheck, 'yyyy-MM-dd');
      if (isCompletedOnDay(dateKey)) {
        currentStreak++;
        dateToCheck = subDays(dateToCheck, 1);
      } else {
        break;
      }
    }
    return currentStreak;
  };

  const checkAndNotifyStreak = (habitId: string, customCompletions: any) => {
    const targetHabit = habits.find(h => h.id === habitId);
    if (!targetHabit) return;
    
    const streak = calculateStreakWithCompletions(habitId, customCompletions);
    // Standard milestone thresholds: 3, 7, 14, 21, 30, 60, 100, 365
    const isMilestone = [3, 7, 14, 21, 30, 60, 100, 365].includes(streak);
    
    if (isMilestone) {
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification("🏆 Habit Streak Milestone!", {
            body: `Incredible work! You reached a ${streak}-day streak for "${targetHabit.name}"!`,
          });
        } catch (e) {
          console.error("System notification error:", e);
        }
      }
      setMilestoneCelebration({
        habitName: targetHabit.name,
        color: targetHabit.color || '#f97316',
        streak
      });
    }
  };

  const handleToggleHabit = (habitId: string, day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const isCompletedNow = !completions[dateKey]?.[habitId];

    // Optimistic UI check feedback animation
    const target = document.querySelector(`[data-habit-id="${habitId}"][data-date="${dateKey}"]`);
    if (target) {
      target.classList.add('scale-75');
      setTimeout(() => target.classList.remove('scale-75'), 200);
    }

    if (onUpdateHabitCompletion) {
      onUpdateHabitCompletion(dateKey, habitId, isCompletedNow);
    } else {
      onUpdate((prev: AppData) => {
        const currentCompletions = prev.habitCompletions || {};
        const dayCompletions = { ...(currentCompletions[dateKey] || {}) };
        dayCompletions[habitId] = isCompletedNow;
        return { ...prev, habitCompletions: { ...currentCompletions, [dateKey]: dayCompletions } };
      });
    }

    if (isCompletedNow && isToday(day)) {
      // Create a temporary completion object for streak check notification
      const tempCompletions = { ...completions, [dateKey]: { ...(completions[dateKey] || {}), [habitId]: true } };
      checkAndNotifyStreak(habitId, tempCompletions);
    }
  };

  const handleStartEditHabit = (habit: Habit) => {
    setNewHabitName(habit.name);
    setNewHabitCategory(habit.category || 'General');
    setIsNumericHabit(!!habit.isNumeric);
    setHabitTargetValue(habit.targetValue || 2);
    setHabitUnit(habit.unit || 'liters');
    setHabitColor(habit.color || '#ea580c');
    setEditingHabitId(habit.id);
    setIsAddingHabit(true);
  };

  const handleSaveHabit = () => {
    if (!newHabitName.trim()) return;
    
    onUpdate((prev: AppData) => {
      const currentHabits = prev.habits || [];
      if (editingHabitId) {
        // Edit mode
        const updatedHabits = currentHabits.map(h => {
          if (h.id === editingHabitId) {
            return {
              ...h,
              name: newHabitName.trim(),
              color: habitColor,
              isNumeric: isNumericHabit,
              targetValue: isNumericHabit ? habitTargetValue : undefined,
              unit: isNumericHabit ? habitUnit.trim() : undefined,
              category: newHabitCategory.trim() || 'General'
            };
          }
          return h;
        });
        return { ...prev, habits: updatedHabits };
      } else {
        // Create mode
        const newHabit: Habit = {
          id: uuidv4(),
          name: newHabitName.trim(),
          order: currentHabits.length,
          color: habitColor,
          isNumeric: isNumericHabit,
          targetValue: isNumericHabit ? habitTargetValue : undefined,
          unit: isNumericHabit ? habitUnit.trim() : undefined,
          category: newHabitCategory.trim() || 'General'
        };
        return { ...prev, habits: [...currentHabits, newHabit] };
      }
    });

    setNewHabitName('');
    setNewHabitCategory('');
    setIsNumericHabit(false);
    setHabitTargetValue(2);
    setHabitUnit('liters');
    setHabitColor('#ea580c');
    setEditingHabitId(null);
    setIsAddingHabit(false);
  };

  const handleDeleteHabit = (id: string) => {
    if (window.confirm('Delete this habit and all its history?')) {
      onUpdate((prev: AppData) => ({
        ...prev,
        habits: (prev.habits || []).filter(h => h.id !== id)
      }));
    }
  };

  const handleExportCSV = () => {
    if (habits.length === 0) {
      alert("No habits available to export.");
      return;
    }

    const csvRows: string[] = [];
    csvRows.push("Habit Tracker Mastery - 30-Day Completion History Ledger");
    csvRows.push(`Exported on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`);
    csvRows.push("");

    // 1. Habit Completion Summary section
    csvRows.push("HABIT SUMMARY STATUS");
    csvRows.push("Habit Name,Current Streak,Habit Type,Target Goal,Unit,Days Completed (Out of 30),Achievement Rate (%)");

    const last30Days: Date[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      last30Days.push(subDays(today, i));
    }

    habits.forEach(habit => {
      let completedCount = 0;
      last30Days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        if (isHabitCompletedOnDay(habit, dateKey)) {
          completedCount++;
        }
      });

      const streak = getStreak(habit.id);
      const habitType = habit.isNumeric ? "Numeric" : "Checkbox";
      const targetGoal = habit.isNumeric ? (habit.targetValue || 0) : "N/A";
      const unit = habit.isNumeric ? (habit.unit || "units") : "N/A";
      const achievementRate = ((completedCount / 30) * 100).toFixed(1);

      const nameEscaped = habit.name.replace(/"/g, '""');
      csvRows.push(`"${nameEscaped}",${streak},${habitType},"${targetGoal}","${unit}",${completedCount},${achievementRate}%`);
    });

    csvRows.push("");
    csvRows.push("DETAILED COMPLETED LOG (LAST 30 DAYS)");
    csvRows.push("Date,Day of Week,Habit Name,Habit Type,Value/Status,Target Goal,Achieved (Yes/No)");

    last30Days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayOfWeek = format(day, 'EEEE');

      habits.forEach(habit => {
        const isCompleted = isHabitCompletedOnDay(habit, dateKey);
        const compVal = completions[dateKey]?.[habit.id];
        
        let valueStr = "No";
        if (habit.isNumeric) {
          valueStr = compVal !== undefined && compVal !== null ? String(compVal) : "0";
        } else {
          valueStr = compVal ? "Yes" : "No";
        }

        const habitType = habit.isNumeric ? "Numeric" : "Checkbox";
        const targetGoal = habit.isNumeric ? (habit.targetValue || 0) : "N/A";
        const achievedStr = isCompleted ? "Yes" : "No";
        const nameEscaped = habit.name.replace(/"/g, '""');

        csvRows.push(`${dateKey},${dayOfWeek},"${nameEscaped}",${habitType},"${valueStr}","${targetGoal}",${achievedStr}`);
      });
    });

    const blob = new Blob(['\ufeff' + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Habit_Tracker_30_Day_Mastery_Export_${format(today, 'yyyyMMdd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isHabitCompletedOnDay = (habit: Habit | undefined, dateKey: string): boolean => {
    if (!habit) return false;
    const comp = completions[dateKey]?.[habit.id];
    if (comp === undefined || comp === null) return false;
    if (habit.isNumeric) {
      const target = habit.targetValue || 0;
      return typeof comp === 'number' ? comp >= target : !!comp;
    }
    return !!comp;
  };

  const handleExportPDF = () => {
    // Create a pristine structured document layout dynamically instead of a direct DOM clone
    const exportContainer = document.createElement('div');
    exportContainer.id = 'habit-tracker-pdf-export-container';
    exportContainer.style.position = 'fixed';
    exportContainer.style.top = '0';
    exportContainer.style.left = '0';
    exportContainer.style.zIndex = '-999999';
    exportContainer.style.pointerEvents = 'none';
    exportContainer.style.width = '900px'; // Consistent capture width mapping to A4 printable area
    exportContainer.style.boxSizing = 'border-box';
    exportContainer.style.backgroundColor = '#ffffff';
    exportContainer.style.color = '#000000';
    exportContainer.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
    exportContainer.style.textAlign = 'left';

    // Build operational disciplines list
    const sortedHabits = [...(data.habits || [])].sort((a, b) => getStreak(b.id) - getStreak(a.id));
    const disciplinesHtml = sortedHabits.map(h => {
      const streak = getStreak(h.id);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc; padding: 12px 18px; border-radius: 12px; border-left: 5px solid ${h.color || '#ea580c'}; word-break: break-word;">
          <span style="font-weight: 800; font-size: 13px; color: #0f172a; text-transform: uppercase;">${h.name}</span>
          <span style="font-weight: 900; color: ${streak > 0 ? '#ea580c' : '#94a3b8'}; font-size: 13px; font-style: italic;">
            STREAK: ${streak}
          </span>
        </div>
      `;
    }).join('');

    exportContainer.innerHTML = `
      <div style="padding: 10px; box-sizing: border-box; background: white;">
        <!-- Header Section -->
        <div style="border-bottom: 6px solid #ea580c; padding-bottom: 25px; margin-bottom: 35px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="font-size: 32px; font-weight: 900; text-transform: uppercase; color: #000; margin: 0; letter-spacing: -1.5px; line-height: 1.1;">Identity Mastery Intelligence</h1>
            <p style="color: #ea580c; font-weight: 900; letter-spacing: 4px; font-size: 11px; margin: 8px 0 0 0; text-transform: uppercase;">SYSTEM ARCHITECTURE PERFORMANCE LOG • ${format(new Date(), 'MMMM yyyy')}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 2px;">Identity Architecture System</div>
          </div>
        </div>

        <!-- Divided Contents -->
        <div style="display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 40px; margin-bottom: 40px; align-items: start;">
          <!-- Left: Operational Disciplines -->
          <div>
            <h2 style="font-size: 15px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 20px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Operational Disciplines</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
              ${disciplinesHtml || '<div style="color: #64748b; font-size: 13px; font-style: italic;">No active disciplines loaded.</div>'}
            </div>
          </div>

          <!-- Right: Statistics & Insights -->
          <div style="display: flex; flex-direction: column; gap: 25px;">
            <!-- Global Velocity Stats -->
            <div style="background-color: #0f172a; padding: 25px; border-radius: 24px; color: white; border: 1px solid rgba(255,255,255,0.1);">
              <h3 style="font-size: 11px; font-weight: 900; color: #ea580c; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 20px 0;">Global Velocity</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                  <span style="font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Active Nodes</span>
                  <span style="font-size: 36px; font-weight: 900; color: #ffffff;">${habits.length}</span>
                </div>
                <div>
                  <span style="font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Mastery Flow</span>
                  <span style="font-size: 36px; font-weight: 900; color: #10b981;">${habits.filter(h => getStreak(h.id) > 0).length}</span>
                </div>
              </div>
            </div>

            <!-- Insight Box -->
            <div style="padding: 25px; background-color: #f1f5f9; border-radius: 24px;">
              <h3 style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">Temporal Insight</h3>
              <p style="font-size: 12px; line-height: 1.7; color: #334155; font-style: italic; font-weight: 600; margin: 0;">
                "The quality of your hierarchy determines the quality of your output. This summary reflects a commitment to the architecture of character."
              </p>
            </div>
          </div>
        </div>

        <!-- Footer Section -->
        <div style="border-top: 3px solid #000000; padding-top: 25px; text-align: center; margin-top: 20px;">
          <p style="font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 8px; margin: 0;">IDENTITY ARCHITECTURE SYSTEM • PERFORMANCE HUB VER: ALPHA</p>
        </div>
      </div>
    `;

    // Print stylesheet
    const style = document.createElement('style');
    style.innerHTML = `
      @page {
        size: A4 landscape;
        margin: 10mm;
      }
      body {
        background-color: #ffffff;
        color: #000000;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      h1, h2, h3, p, span {
        font-family: 'Inter', sans-serif !important;
      }
      * {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    `;
    exportContainer.appendChild(style);

    document.body.appendChild(exportContainer);

    const opt = {
      margin:       [10, 10, 10, 10] as [number, number, number, number], // exactly 10mm padding on all sides for safe margins without cut-off
      filename:     `Identity_Mastery_Intelligence_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false, 
        width: 900,
        windowWidth: 900,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff'
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true }
    };

    // To prevent html2canvas from crash-looping or hanging on modern CSS stylesheet rules (e.g. Tailwind v4 variables, container queries),
    // we temporarily disable all external stylesheets during PDF rendering.
    const disabledSheets: (HTMLStyleElement | HTMLLinkElement)[] = [];
    try {
      Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).forEach((sheet) => {
        if (sheet instanceof HTMLStyleElement || sheet instanceof HTMLLinkElement) {
          if (!exportContainer.contains(sheet) && (sheet as any).disabled !== true) {
            (sheet as any).disabled = true;
            disabledSheets.push(sheet);
          }
        }
      });
    } catch (err) {
      console.warn("Could not disable style sheets during PDF render:", err);
    }

    // @ts-ignore
    html2pdf().from(exportContainer).set(opt).save().then(() => {
      // Restore all disabled sheets
      disabledSheets.forEach((sheet) => {
        try {
          (sheet as any).disabled = false;
        } catch (err) {
          console.error("Error restoring stylesheet:", err);
        }
      });
      document.body.removeChild(exportContainer);
    }).catch((e: any) => {
      console.error(e);
      // Restore on failure too!
      disabledSheets.forEach((sheet) => {
        try {
          (sheet as any).disabled = false;
        } catch (err) {
          console.error("Error restoring stylesheet:", err);
        }
      });
      document.body.removeChild(exportContainer);
      alert('Export failed. Please try again.');
    });
  };

  const handleExportMonthJSON = () => {
    const monthKey = format(currentDate, 'yyyy-MM');
    const monthDays = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
    
    const archiveData = {
      archive_type: "Habit Completion History",
      target_month: format(currentDate, 'MMMM yyyy'),
      exported_at: new Date().toISOString(),
      summary: {
        total_habits: habits.length,
        completions_by_habit: habits.map(h => {
          let count = 0;
          monthDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            if (completions[dateStr]?.[h.id]) count++;
          });
          return {
            habit_id: h.id,
            habit_name: h.name,
            category: h.category || 'General',
            completions_count: count,
            completion_rate: ((count / monthDays.length) * 100).toFixed(1) + "%"
          };
        })
      },
      habits_registry: habits.map(h => ({
        id: h.id,
        name: h.name,
        category: h.category || 'General',
        is_numeric: h.isNumeric || false,
        target_value: h.targetValue,
        unit: h.unit
      })),
      completions_log: monthDays.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayComps = completions[dateStr] || {};
        const logs: Record<string, any> = {};
        habits.forEach(h => {
          if (dayComps[h.id] !== undefined) {
            logs[h.name] = dayComps[h.id];
          }
        });
        return {
          date: dateStr,
          completions: logs
        };
      }).filter(log => Object.keys(log.completions).length > 0)
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(archiveData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Habit_Mastery_Archive_${monthKey}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportMonthPDF = () => {
    const monthKey = format(currentDate, 'yyyy-MM');
    const monthDays = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
    
    const exportContainer = document.createElement('div');
    exportContainer.id = 'habit-tracker-monthly-pdf-container';
    exportContainer.style.position = 'fixed';
    exportContainer.style.top = '0';
    exportContainer.style.left = '0';
    exportContainer.style.zIndex = '-999999';
    exportContainer.style.pointerEvents = 'none';
    exportContainer.style.width = '900px';
    exportContainer.style.boxSizing = 'border-box';
    exportContainer.style.backgroundColor = '#ffffff';
    exportContainer.style.color = '#000000';
    exportContainer.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
    exportContainer.style.textAlign = 'left';

    const listHtml = habits.map(h => {
      let count = 0;
      monthDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (completions[dateStr]?.[h.id]) count++;
      });
      const completionRate = ((count / monthDays.length) * 100).toFixed(1);
      return `
        <tr style="border-bottom: 1px solid #e1e8ed;">
          <td style="padding: 12px 16px; font-weight: 800; color: #0f172a; text-transform: uppercase; font-size: 11px;">${h.name}</td>
          <td style="padding: 12px 16px; color: #64748b; font-weight: 700; font-size: 11px; text-transform: uppercase;">${h.category || 'General'}</td>
          <td style="padding: 12px 16px; text-align: center; font-weight: 900; color: #0f172a; font-size: 11px;">${count} / ${monthDays.length}</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 950; color: #ea580c; font-size: 11px;">${completionRate}%</td>
        </tr>
      `;
    }).join('');

    exportContainer.innerHTML = `
      <div style="padding: 30px; box-sizing: border-box; background: white;">
        <!-- Header Section -->
        <div style="border-bottom: 6px solid #ea580c; padding-bottom: 25px; margin-bottom: 35px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="font-size: 28px; font-weight: 900; text-transform: uppercase; color: #000; margin: 0; letter-spacing: -1.5px; line-height: 1.1;">Monthly Archive Performance</h1>
            <p style="color: #ea580c; font-weight: 900; letter-spacing: 4px; font-size: 10px; margin: 8px 0 0 0; text-transform: uppercase;">Habit Completion Summary • ${format(currentDate, 'MMMM yyyy')}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 2px;">Identity Architecture System</div>
          </div>
        </div>

        <div style="margin-bottom: 35px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 12px 16px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Discipline</th>
                <th style="padding: 12px 16px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Category</th>
                <th style="padding: 12px 16px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; text-align: center;">Completed Days</th>
                <th style="padding: 12px 16px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; text-align: right;">Completion Margin</th>
              </tr>
            </thead>
            <tbody>
              ${listHtml || '<tr><td colspan="4" style="padding: 24px; text-align: center; color: #64748b; font-style: italic;">No current performance data recorded in this epoch.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="background-color: #f1f5f9; padding: 25px; border-radius: 20px; margin-bottom: 35px;">
          <h3 style="font-size: 10px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0;">Archival Intelligence</h3>
          <p style="font-size: 11px; line-height: 1.6; color: #334155; margin: 0;">
            This registry constitutes an official archive log of character vector progressions over the target epoch. Maintain continuous alignment to maximize downstream output density.
          </p>
        </div>

        <!-- Footer Section -->
        <div style="border-top: 3px solid #000000; padding-top: 25px; text-align: center;">
          <p style="font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 6px; margin: 0;">IDENTITY ARCHITECTURE ARCHIVE • SECURED RECORD VERSION 1.1</p>
        </div>
      </div>
    `;

    // Print stylesheet
    const style = document.createElement('style');
    style.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      body {
        background-color: #ffffff;
        color: #000000;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      h1, h2, h3, p, span, th, td {
        font-family: 'Inter', sans-serif !important;
      }
      * {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    `;
    exportContainer.appendChild(style);

    document.body.appendChild(exportContainer);

    const opt = {
      margin:       [10, 10, 10, 10] as [number, number, number, number],
      filename:     `Habit_Completion_Archive_${monthKey}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false, 
        width: 900,
        windowWidth: 900,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff'
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
    };

    // To prevent html2canvas from crash-looping or hanging on modern CSS stylesheet rules (e.g. Tailwind v4 variables, container queries),
    // we temporarily disable all external stylesheets during PDF rendering.
    const disabledSheets: (HTMLStyleElement | HTMLLinkElement)[] = [];
    try {
      Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).forEach((sheet) => {
        if (sheet instanceof HTMLStyleElement || sheet instanceof HTMLLinkElement) {
          if (!exportContainer.contains(sheet) && (sheet as any).disabled !== true) {
            (sheet as any).disabled = true;
            disabledSheets.push(sheet);
          }
        }
      });
    } catch (err) {
      console.warn("Could not disable style sheets during PDF render:", err);
    }

    // @ts-ignore
    html2pdf().from(exportContainer).set(opt).save().then(() => {
      // Restore all disabled sheets
      disabledSheets.forEach((sheet) => {
        try {
          (sheet as any).disabled = false;
        } catch (err) {
          console.error("Error restoring stylesheet:", err);
        }
      });
      document.body.removeChild(exportContainer);
    }).catch((e: any) => {
      console.error(e);
      // Restore on failure too!
      disabledSheets.forEach((sheet) => {
        try {
          (sheet as any).disabled = false;
        } catch (err) {
          console.error("Error restoring stylesheet:", err);
        }
      });
      document.body.removeChild(exportContainer);
      alert('Export failed. Please try again.');
    });
  };

  const streakData = useMemo(() => {
    const last90Days = Array.from({ length: 90 }, (_, i) => subDays(new Date(), 89 - i));
    return last90Days.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayCompletions = (data.habits || []).reduce((acc, h) => {
        const comp = (data.habitCompletions || {})[dateKey]?.[h.id];
        if (comp === undefined || comp === null) return acc;
        if (h.isNumeric) {
          return acc + (typeof comp === 'number' && comp >= (h.targetValue || 0) ? 1 : 0);
        }
        return acc + (comp ? 1 : 0);
      }, 0);
      return {
        date: format(day, 'MMM d'),
        fullDate: dateKey,
        completions: dayCompletions,
      };
    });
  }, [data.habits, data.habitCompletions]);

  const groupedHabits = useMemo(() => {
    const groups: Record<string, Habit[]> = {};
    (data.habits || []).forEach(h => {
      const cat = h.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(h);
    });
    return groups;
  }, [data.habits]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    (data.habits || []).forEach(h => {
      const cat = (h.category || 'General').trim();
      if (cat) cats.add(cat);
    });
    // Ensure standard categories exist as presets
    ['Health', 'Professional', 'Personal', 'General'].forEach(c => cats.add(c));
    return Array.from(cats).sort();
  }, [data.habits]);

  const getWeeklyProgress = (habit: Habit) => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    
    let completedCount = 0;
    const totalTarget = habit.isNumeric ? (habit.targetValue || 1) * 5 : 5; // target completion 5 times/week by default
    let accumulatedValue = 0;

    days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const val = completions[dateKey]?.[habit.id];
      if (val !== undefined && val !== null) {
        if (habit.isNumeric) {
          accumulatedValue += typeof val === 'number' ? val : (habit.targetValue || 1);
        } else {
          if (val) completedCount++;
        }
      }
    });

    if (habit.isNumeric) {
      const progress = Math.min(100, Math.round((accumulatedValue / totalTarget) * 100));
      return { 
        percentage: progress, 
        text: `${accumulatedValue} / ${totalTarget} ${habit.unit || ''}`,
        value: accumulatedValue,
        target: totalTarget
      };
    } else {
      const progress = Math.min(100, Math.round((completedCount / 5) * 100));
      return { 
        percentage: progress, 
        text: `${completedCount} / 5 days`,
        value: completedCount,
        target: 5
      };
    }
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleResetCategoryWeek = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    
    onUpdate((prev: AppData) => {
      const newCompletions = { ...prev.habitCompletions };
      const habitsInCat = (prev.habits || []).filter(h => (h.category || 'General') === resetTargetCategory);
      
      if (habitsInCat.length === 0) return prev;

      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        if (newCompletions[dateKey]) {
          const dayComps = { ...newCompletions[dateKey] };
          let changed = false;
          habitsInCat.forEach(h => {
            if (dayComps[h.id] !== undefined) {
              delete dayComps[h.id];
              changed = true;
            }
          });
          
          if (changed) {
            if (Object.keys(dayComps).length === 0) {
              delete newCompletions[dateKey];
            } else {
              newCompletions[dateKey] = dayComps;
            }
          }
        }
      });
      
      return { ...prev, habitCompletions: newCompletions };
    });
    setIsResettingWeek(false);
  };

  const flattenedItems = useMemo(() => {
    const list: any[] = [];
    Object.keys(groupedHabits).sort().forEach(cat => {
      if (categoryFilter !== 'All' && cat !== categoryFilter) return;
      list.push({ type: 'header', name: cat });
      if (!collapsedCategories[cat]) {
        groupedHabits[cat].forEach(habit => {
          list.push({ type: 'habit', habit });
        });
      }
    });
    return list;
  }, [groupedHabits, collapsedCategories, categoryFilter]);

  const getItemSize = (index: number) => {
    return flattenedItems[index].type === 'header' ? 60 : 90;
  };

  const listHeight = useMemo(() => {
    if (flattenedItems.length === 0) return 400;
    const totalHeight = flattenedItems.reduce((acc, _, idx) => acc + getItemSize(idx), 0);
    // Dynamic height without hard upper limits so newly added habits are fully rendered without vertical inner container clipping
    return Math.max(400, totalHeight + 15);
  }, [flattenedItems]);

  const Row = ({ index, style }: { index: number, style: any }) => {
    const item = flattenedItems[index];

    if (item.type === 'header') {
      const isCollapsed = collapsedCategories[item.name];
      return (
        <div 
          style={style} 
          className="bg-zinc-100/80 backdrop-blur-md border-y border-zinc-200/50 px-8 py-3 flex items-center justify-between sticky left-0 z-20 cursor-pointer hover:bg-zinc-200 transition-colors h-full animate-fade-in"
          onClick={() => toggleCategory(item.name)}
        >
           <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-[4px] text-orange-600/40">Grouping</span>
              <h4 className="text-md font-black text-slate-800 uppercase italic tracking-tight">{item.name}</h4>
           </div>
           <div className="flex items-center gap-4">
              <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{groupedHabits[item.name].length} Mastery Disciplines</span>
              <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }}>
                 <ChevronRight size={18} />
              </motion.div>
           </div>
        </div>
      );
    }

    const { habit } = item;
    const streak = getStreak(habit.id);
    const habitColor = habit.color || '#ea580c';

    return (
      <div style={style} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-zinc-100 dark:border-zinc-800 flex items-center overflow-visible">
         <div 
           className={`${isDisciplinesFrozen ? 'sticky left-0 z-10 shadow-[4px_0_15px_rgba(0,0,0,0.06)]' : 'relative'} transition-all bg-white/95 dark:bg-zinc-900/95 py-2 px-4 border-r border-black/10 dark:border-white/10 shrink-0 h-full flex flex-col justify-center`}
           style={{
             width: disciplinesWidth,
             borderLeft: `6px solid ${habitColor}`,
             backgroundColor: `${habitColor}0d`
           }}
         >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden w-full">
                <span className="text-sm md:text-md font-black uppercase tracking-tight truncate animate-fade-in" style={{ color: habitColor }}>{habit.name}</span>
                {streak > 0 && (
                  <div className="flex items-center gap-1 animate-pulse" style={{ color: habitColor }}>
                    <Zap size={12} />
                    <span className="text-[10px] font-bold tracking-tight">{streak} Day Streak</span>
                  </div>
                )}
                
                {/* Weekly progress bar underneath habit details */}
                {(() => {
                  const progress = getWeeklyProgress(habit);
                  return (
                    <div className="mt-1 w-full">
                      <div className="flex items-center justify-between text-[8px] font-extrabold text-zinc-500 uppercase tracking-widest items-center leading-none">
                        <span>WK PROGRESS</span>
                        <span style={{ color: habitColor }} className="font-extrabold">{progress.text}</span>
                      </div>
                      <div className="w-full bg-zinc-200/60 dark:bg-zinc-800 rounded-full h-1 mt-0.5 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{ 
                            width: `${progress.percentage}%`, 
                            backgroundColor: habitColor 
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button 
                  onClick={() => handleStartEditHabit(habit)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-black/30 dark:text-white/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all rounded-lg shrink-0"
                  title="Edit Habit Settings & Color"
                >
                  <Edit3 size={13} />
                </button>
                <button 
                  onClick={() => handleDeleteHabit(habit.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-black/30 dark:text-white/30 hover:text-red-600 dark:hover:text-red-400 transition-all rounded-lg shrink-0"
                  title="Delete Habit"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
         </div>
         <div 
           className="flex-1 flex overflow-visible h-full"
           style={{
             backgroundColor: `${habitColor}03`
           }}
         >
            {daysInMonth.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const noteText = data.habitNotes?.[dateKey]?.[habit.id] || '';
              
              if (habit.isNumeric) {
                const progressVal = typeof completions[dateKey]?.[habit.id] === 'number' 
                  ? (completions[dateKey]?.[habit.id] as number) 
                  : (completions[dateKey]?.[habit.id] ? (habit.targetValue || 1) : 0);
                const isFullDone = progressVal >= (habit.targetValue || 0);

                return (
                  <div key={day.toString()} className="min-w-[130px] flex items-center justify-center border-r border-black/5 dark:border-white/5 last:border-r-0">
                    <div className="flex flex-col items-center justify-center gap-0.5 select-none w-[110px] mx-auto">
                      <span className="text-[8px] font-black text-zinc-400 tracking-wider leading-none mb-0.5" style={{ color: isFullDone ? habitColor : '' }}>
                        {isFullDone ? 'DONE' : 'GOAL'}
                      </span>
                      <div className="flex items-center gap-1 bg-white/40 dark:bg-black/20 border border-zinc-200/50 dark:border-zinc-800 p-0.5 rounded-full shadow-sm">
                        <button 
                          onClick={() => adjustNumericValue(habit.id, day, -0.5)}
                          className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[10px] font-black flex items-center justify-center cursor-pointer border border-zinc-200/60 dark:border-zinc-700 transition-all active:scale-95"
                        >-</button>
                        <div 
                          onClick={() => adjustNumericValue(habit.id, day, isFullDone ? -progressVal : (habit.targetValue || 2) - progressVal)}
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition-all ${isFullDone ? 'text-white font-extrabold shadow-sm' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                          style={{ backgroundColor: isFullDone ? habitColor : '' }}
                        >{progressVal}</div>
                        <button 
                          onClick={() => adjustNumericValue(habit.id, day, 0.5)}
                          className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[10px] font-black flex items-center justify-center cursor-pointer border border-zinc-200/60 dark:border-zinc-700 transition-all active:scale-95"
                        >+</button>
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider leading-none truncate max-w-[65px]">
                          {habit.targetValue} {habit.unit}
                        </span>
                        <button onClick={() => openNoteDialog(habit, dateKey)} className={`p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-all relative ${noteText ? 'text-orange-500 scale-105' : 'text-slate-400'}`}>
                          <MessageSquare size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              const isCompleted = !!completions[dateKey]?.[habit.id];
              return (
                <div key={day.toString()} className="min-w-[130px] flex items-center justify-center border-r border-black/5 dark:border-white/5 last:border-r-0">
                  <button 
                    onClick={() => handleToggleHabit(habit.id, day)}
                    className={`w-9 h-9 rounded-full transition-all flex items-center justify-center ${isCompleted ? 'scale-105 shadow-md' : 'bg-black/5 dark:bg-white/5 text-transparent hover:bg-black/10 dark:hover:bg-white/10'}`}
                    style={{ backgroundColor: isCompleted ? habitColor : '', color: 'white' }}
                  >
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              );
            })}
         </div>
      </div>
    );
  };

  const adjustNumericValue = (habitId: string, day: Date, amount: number) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    
    if (onUpdateHabitCompletion) {
       const currentVal = typeof completions[dateKey]?.[habitId] === 'number' 
          ? (completions[dateKey]?.[habitId] as number) 
          : (completions[dateKey]?.[habitId] ? 1 : 0);
       let newVal = Math.max(0, currentVal + amount);
       newVal = Math.round(newVal * 10) / 10;
       onUpdateHabitCompletion(dateKey, habitId, newVal);
    } else {
      onUpdate((prev: AppData) => {
        const currentCompletions = prev.habitCompletions || {};
        const dayCompletions = { ...(currentCompletions[dateKey] || {}) };
        
        const habit = (prev.habits || []).find(h => h.id === habitId);
        if (!habit) return prev;

        const currentVal = typeof dayCompletions[habitId] === 'number' 
          ? (dayCompletions[habitId] as number) 
          : (dayCompletions[habitId] ? (habit.targetValue || 1) : 0);
          
        let newVal = Math.max(0, currentVal + amount);
        newVal = Math.round(newVal * 10) / 10;
        dayCompletions[habitId] = newVal;
        
        return { ...prev, habitCompletions: { ...currentCompletions, [dateKey]: dayCompletions } };
      });
    }
  };

  const getStreak = (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return 0;
    
    let currentStreak = 0;
    const today = new Date();
    
    // Check if missed yesterday and today. If so, streak is 0.
    const todayKey = format(today, 'yyyy-MM-dd');
    const yesterdayKey = format(subDays(today, 1), 'yyyy-MM-dd');
    
    let dateToCheck = today;
    
    // If today is not completed, check if yesterday was. If neither, streak is 0.
    if (!isHabitCompletedOnDay(habit, todayKey)) {
      if (!isHabitCompletedOnDay(habit, yesterdayKey)) {
        return 0;
      }
      dateToCheck = subDays(today, 1);
    }
    
    let safetyLimit = 1000;
    while (safetyLimit > 0) {
      safetyLimit--;
      const dateKey = format(dateToCheck, 'yyyy-MM-dd');
      if (isHabitCompletedOnDay(habit, dateKey)) {
        currentStreak++;
        dateToCheck = subDays(dateToCheck, 1);
      } else {
        break;
      }
    }
    return currentStreak;
  };

  const getAISuggestions = async () => {
    if (isSuggesting) return;
    setIsSuggesting(true);
    setSuggestedHabits([]);

    const existingHabits = habits.map(h => h.name).join(', ');
    const recentNotes = Object.values(notes).slice(-5).join('\n');
    const performance = habits.map(h => `${h.name}: ${getStreak(h.id)} day streak`).join(', ');

    const prompt = `Based on my current habits: [${existingHabits}], my recent journal entries: [${recentNotes}], and my performance: [${performance}], suggest 3 new habits that would complement my growth. 
    Format: Return ONLY a JSON array of strings, e.g., ["Meditate for 10 min", "Drink 2L water", "Read 5 pages"]. No other text.`;

    try {
      const result = await callNeuralEngine(
        'gemini-3-flash-preview',
        prompt,
        "You are an expert life optimizer and habit coach. Focus on complementary habits for holistic growth."
      );
      
      // Try to parse the JSON array
      const cleaned = result.text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        setSuggestedHabits(parsed);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to get AI suggestions.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const applySuggestedHabit = (name: string) => {
    const habitColor = HABIT_COLORS[habits.length % HABIT_COLORS.length].hex;
    
    const newHabit: Habit = {
      id: uuidv4(),
      name: name,
      order: habits.length,
      color: habitColor
    };
    
    onUpdate((prev: AppData) => ({
      ...prev,
      habits: [...(prev.habits || []), newHabit]
    }));
    setSuggestedHabits(prev => prev.filter(h => h !== name));
  };

  if (isFullScreen) {
    return (
      <div className="flex-1 flex flex-col p-4 md:p-8 lg:p-12 overflow-y-auto bg-transparent font-sans relative">
        <div className="w-full bg-white/70 backdrop-blur-3xl rounded-[32px] p-6 md:p-10 border border-white/20 shadow-2xl">
          {/* Full Screen Header */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/10">
             <h2 className="text-2xl md:text-5xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-4">
                <CalendarIcon style={{ color: data.settings?.dateTextColor || '#ea580c' }} size={32} />
                Monthly Planner
             </h2>
             <button 
              onClick={() => setIsFullScreen(false)}
              className="p-3 md:p-4 bg-slate-900 text-white rounded-2xl hover:bg-orange-600 transition-all shadow-xl flex items-center justify-center shrink-0"
             >
                <Minimize2 size={24} />
             </button>
          </div>

          {/* Top Planning Board */}
          <div className="mb-8">
             <div className="bg-slate-50 border border-slate-100 rounded-[32px] p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl -mr-16 -mt-16"></div>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                          <Edit3 size={18} />
                      </div>
                      <div>
                          <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest leading-none mb-1">Architecture of Resolve</p>
                          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-3">
                              {format(selectedPlanningDate, 'MMMM do, yyyy')}
                              <button 
                                onClick={handleShareNote}
                                disabled={isSharingNote}
                                className="text-slate-400 hover:text-orange-500 transition-all disabled:opacity-50"
                                title="Share Today's Notes"
                              >
                                <Share2 size={20} className={isSharingNote ? "animate-spin" : ""} />
                              </button>
                              <button onClick={() => { 
                                const html = `<ul style="list-style-type: none; padding-left: 0; margin-top: 4px; margin-bottom: 4px;"><li style="display: flex; gap: 8px; align-items: flex-start;"><span contenteditable="false" class="task-checkbox" style="cursor: pointer; user-select: none;">⬜</span><span>&nbsp;</span></li></ul>`; 
                                const dateKey = format(selectedPlanningDate, 'yyyy-MM-dd'); 
                                let safeVal = notes[dateKey] || ''; 
                                if (typeof safeVal !== 'string' || safeVal === '[object Object]') safeVal = ''; 
                                const newNote = safeVal + html; 
                                if (onUpdateDailyNote) { 
                                  onUpdateDailyNote(dateKey, newNote); 
                                } else { 
                                  onUpdate({ ...data, dailyNotes: { ...(data.dailyNotes || {}), [dateKey]: newNote } }); 
                                } 
                              }} className="text-slate-400 hover:text-emerald-600 transition-colors" title="Insert Checklist"><CheckSquare size={20} /></button>
                          </h3>
                      </div>
                   </div>
                </div>
                <RichTextDiv 
                    value={notes[format(selectedPlanningDate, 'yyyy-MM-dd')] || ''}
                    onChange={(val) => {
                      const dateKey = format(selectedPlanningDate, 'yyyy-MM-dd');
                      if (onUpdateDailyNote) {
                        onUpdateDailyNote(dateKey, val);
                      } else {
                        onUpdate((prev: AppData) => ({ ...prev, dailyNotes: { ...(prev.dailyNotes || {}), [dateKey]: val } }));
                      }
                    }}
                    className="w-full h-24 bg-white rounded-2xl p-4 text-slate-800 font-bold text-lg outline-none border border-slate-200 focus:border-orange-500 transition-all placeholder:text-slate-400 overflow-y-auto overflow-x-hidden shadow-inner block"
                    placeholder="Define your focus..."
                />
             </div>
          </div>

          {/* 30 Day Grid View */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4 pb-10">
            {daysInMonth.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const isSel = isSameDay(day, selectedPlanningDate);
              const dailyCompletions = habits.reduce((acc, h) => acc + (isHabitCompletedOnDay(h, dateKey) ? 1 : 0), 0);
              const dayNote = notes[dateKey];
              
              return (
                <motion.div
                  key={day.toString()}
                  whileHover={{ y: -3, backgroundColor: 'rgba(0,0,0,0.02)' }}
                  onClick={() => setSelectedPlanningDate(day)}
                  className={`aspect-square rounded-[24px] p-4 cursor-pointer border transition-all relative overflow-hidden flex flex-col justify-between ${isSel ? 'border-orange-500 bg-white shadow-xl scale-[1.05] z-10' : 'border-slate-200/60 bg-slate-50/50 backdrop-blur-md shadow-sm'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-lg font-black ${isToday(day) ? 'text-orange-600 underline decoration-orange-600/30' : 'text-slate-800 opacity-65'}`}>
                      {format(day, 'd')}
                    </span>
                    <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest">
                      {format(day, 'EEE')}
                    </span>
                  </div>

                  <div className="flex-1 mt-1.5 overflow-hidden pointer-events-none min-h-[44px] max-h-[64px] text-[9px] text-slate-700 leading-tight">
                    {dayNote && (
                      <div 
                        className="line-clamp-3 overflow-hidden text-[9px] mini-planner-note select-none text-left" 
                        dangerouslySetInnerHTML={{ __html: dayNote }} 
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-2">
                    {dailyCompletions > 0 && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500 text-white rounded-lg">
                        <CheckCircle2 size={8} strokeWidth={4} />
                        <span className="text-[7px] font-black uppercase tracking-tighter">{dailyCompletions}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="habit-tracker-master-container" className="flex-1 flex flex-col min-h-screen p-4 md:p-8 overflow-y-auto bg-transparent font-sans w-full max-w-none">


      {/* Main View Header */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-6 shrink-0">
        <div className="relative group flex items-center gap-6 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase italic drop-shadow-sm flex items-center gap-3">
            <Target className="text-orange-600" size={28} />
            Performance Mastery Hub
          </h1>
          
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-3xl rounded-full p-1 border border-white/20">
            <button 
              onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
              className="p-2 hover:bg-white/20 rounded-full transition-all text-slate-900"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-4 text-center group/year cursor-pointer relative" onClick={() => {
              const year = prompt('Enter Year:', format(currentDate, 'yyyy'));
              if (year && !isNaN(parseInt(year))) {
                const newDate = new Date(currentDate);
                newDate.setFullYear(parseInt(year));
                setCurrentDate(newDate);
              }
            }}>
               <span className="block text-[8px] font-black uppercase leading-none mb-1 tracking-widest group-hover/year:scale-110 transition-transform" style={{ color: data.settings?.dateTextColor || '#ea580c' }}>{format(currentDate, 'yyyy')}</span>
               <span className="block text-sm font-black text-slate-800 leading-none">{format(currentDate, 'MMMM')}</span>
            </div>
            <button 
              onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
              className="p-2 hover:bg-white/20 rounded-full transition-all text-slate-900"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={() => setShowControls(prev => !prev)}
            className="flex items-center gap-1.5 bg-white/10 backdrop-blur-3xl hover:bg-white/20 text-slate-900 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 transition-all shadow-sm active:scale-95"
            title={showControls ? "Hide controls panel to save space" : "Show controls panel"}
          >
            {showControls ? <EyeOff size={14} className="text-orange-600" /> : <Eye size={14} className="text-orange-600" />}
            <span className="font-extrabold">{showControls ? 'Hide Panel' : 'Show Panel'}</span>
          </button>

          <button
            onClick={() => setIsAddingHabit(true)}
            className="flex items-center justify-center bg-gradient-to-br from-orange-600 to-orange-400 hover:from-orange-700 hover:to-orange-500 text-white w-9 h-9 rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0"
            title="Add New Mastery Habit"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showControls && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex flex-col gap-6 items-center w-full max-w-4xl mx-auto overflow-hidden bg-white/40 dark:bg-zinc-900/40 border border-white/20 p-5 rounded-[28px] shadow-2xl backdrop-blur-xl mt-2"
            >
              {/* Primary action buttons */}
              <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center w-full">
                <button 
                  onClick={getAISuggestions}
                  disabled={isSuggesting}
                  className="flex items-center gap-2 bg-gradient-to-br from-emerald-600 to-emerald-400 text-white px-5 md:px-7 py-3 md:py-4 rounded-2xl font-black text-[10px] md:text-xs tracking-widest hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all shadow-xl disabled:opacity-50 uppercase"
                >
                  {isSuggesting ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
                  AI Lessons
                </button>

                <button 
                  onClick={() => setIsFullScreen(true)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 md:px-7 py-3 md:py-4 rounded-2xl font-black text-[10px] md:text-xs tracking-widest hover:bg-emerald-700 hover:-translate-y-0.5 transition-all shadow-xl uppercase"
                >
                  <Maximize2 size={16} strokeWidth={3} /> Monthly Planner
                </button>

                <button 
                  onClick={() => setIsAddingHabit(true)}
                  className="flex items-center gap-2 bg-gradient-to-br from-orange-600 to-orange-400 text-white px-5 md:px-7 py-3 md:py-4 rounded-2xl font-black text-[10px] md:text-xs tracking-widest hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all shadow-xl shadow-orange-600/20 uppercase"
                >
                  <Plus size={18} strokeWidth={3} /> Mastery Access
                </button>
              </div>

              {/* Unique Wallpaper presets selection gallery */}
              <div className="w-full border-t border-black/5 dark:border-white/5 pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col text-center md:text-left">
                  <span className="text-[10px] font-black uppercase tracking-[3px] text-orange-600">Ambient Studio</span>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400">Transform your workspace environment</span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap justify-center">
                  {AMBIENT_WALLPAPERS.map(wp => (
                    <button
                      key={wp.name}
                      onClick={() => {
                        onUpdate((prev: AppData) => {
                          const baseSettings = prev.settings || { fontSize: 13, fontFamily: 'Inter' };
                          return {
                            ...prev,
                            settings: {
                              ...baseSettings,
                              backgroundImage: wp.url
                            }
                          };
                        });
                      }}
                      className={`group relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all hover:scale-110 active:scale-95 ${data.settings?.backgroundImage === wp.url ? 'border-orange-500 scale-105 shadow-md shadow-orange-500/20' : 'border-white/40 hover:border-orange-300'}`}
                      title={`Switch backdrop to ${wp.name}`}
                    >
                      <img src={wp.url} className="w-full h-full object-cover" alt={wp.name} referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-[7px] font-black uppercase text-white tracking-widest text-center px-1 leading-tight">{wp.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>



      {/* AI Suggestions Dropdown/Panel */}
      <AnimatePresence>
        {suggestedHabits.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[24px] p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
                 <Wand2 size={16} className="text-emerald-500" />
                 Growth Mastery Insights
               </h3>
               <button onClick={() => setSuggestedHabits([])} className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors tracking-widest">Clear</button>
            </div>
            <div className="flex flex-wrap gap-3">
              {suggestedHabits.map((h, i) => (
                <button 
                  key={i}
                  onClick={() => applySuggestedHabit(h)}
                  className="px-4 py-2 bg-white/40 hover:bg-white/60 border border-white/20 rounded-xl text-xs font-bold text-slate-800 transition-all flex items-center gap-2 group"
                >
                  <Plus size={14} className="text-emerald-500 group-hover:scale-125 transition-transform" />
                  {h}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Master Planning Architecture - Compact Hero */}
      <div className={`mb-8 ${isFullScreen ? 'hidden' : 'space-y-6'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Note input at the top as requested */}
          <div className="lg:col-span-8 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[24px] p-6 shadow-xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
                      <Edit3 size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-2">
                        Strategic Planning 
                        <button 
                          onClick={handleShareNote}
                          disabled={isSharingNote}
                          className="text-slate-400 hover:text-orange-500 transition-all disabled:opacity-50"
                          title="Share Today's Notes"
                        >
                          <Share2 size={16} className={isSharingNote ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => { 
                          const html = `<ul style="list-style-type: none; padding-left: 0; margin-top: 4px; margin-bottom: 4px;"><li style="display: flex; gap: 8px; align-items: flex-start;"><span contenteditable="false" class="task-checkbox" style="cursor: pointer; user-select: none;">⬜</span><span>&nbsp;</span></li></ul>`; 
                          const dateKey = format(selectedPlanningDate, 'yyyy-MM-dd'); 
                          let safeVal = notes[dateKey] || ''; 
                          if (typeof safeVal !== 'string' || safeVal === '[object Object]') safeVal = ''; 
                          const newNote = safeVal + html; 
                                  if (onUpdateDailyNote) { 
                                    onUpdateDailyNote(dateKey, newNote); 
                                  } else { 
                                    onUpdate((prev: AppData) => ({ ...prev, dailyNotes: { ...(prev.dailyNotes || {}), [dateKey]: newNote } })); 
                                  } 
                        }} className="text-slate-400 hover:text-emerald-600 transition-colors" title="Insert Checklist"><CheckSquare size={16} /></button>
                      </h3>
                      <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest leading-none">{format(selectedPlanningDate, 'MMMM do, yyyy')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {eachDayOfInterval({ 
                      start: subDays(selectedPlanningDate, 3), 
                      end: endOfWeek(selectedPlanningDate, { weekStartsOn: 1 })
                    }).slice(0, 7).map(day => (
                      <button 
                        key={day.toString()}
                        onClick={() => setSelectedPlanningDate(day)}
                        className={`w-10 h-10 rounded-xl text-[9px] font-black transition-all flex flex-col items-center justify-center ${isSameDay(day, selectedPlanningDate) ? 'bg-orange-600 text-white shadow-lg' : 'bg-white/10 text-slate-600 hover:bg-white/30'}`}
                      >
                        <span>{format(day, 'd')}</span>
                        <span className="text-[6px] opacity-60 uppercase">{format(day, 'EEE')[0]}</span>
                      </button>
                    ))}
                  </div>
              </div>
              <RichTextDiv 
                 value={notes[format(selectedPlanningDate, 'yyyy-MM-dd')] || ''}
                 onChange={(val) => {
                   const dateKey = format(selectedPlanningDate, 'yyyy-MM-dd');
                   if (onUpdateDailyNote) {
                     onUpdateDailyNote(dateKey, val);
                   } else {
                     onUpdate((prev: AppData) => ({ ...prev, dailyNotes: { ...(prev.dailyNotes || {}), [dateKey]: val } }));
                   }
                 }}
                 placeholder={`Mission goals for tomorrow...`}
                 className="w-full h-20 bg-white/5 rounded-xl p-4 text-slate-800 font-bold text-sm outline-none border border-transparent focus:border-orange-500/30 transition-all placeholder:text-slate-400 overflow-y-auto block"
              />
          </div>

          <div className="lg:col-span-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[24px] p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1 italic">
                  <Zap size={14} /> Weekly Insight
                </h4>
                <div 
                  className="text-[10px] font-bold text-slate-500 line-clamp-3 overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: data.reflections?.weeklyReview?.content || "Synchronize your objectives for peak efficiency." }}
                />
              </div>
          </div>
        </div>
      </div>

      {/* Category Filter Controls */}
      <div className={`mt-2 ${isFullScreen ? 'hidden' : ''}`}>
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[24px] p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">Domain Filter</span>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none bg-white border border-zinc-200 rounded-xl px-4 py-2.5 pr-10 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-800 outline-none focus:border-orange-500 shadow-sm cursor-pointer"
              >
                <option value="All">All Domains / Categories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setCategoryFilter('All')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                categoryFilter === 'All'
                  ? 'bg-orange-600 text-white border-orange-600 shadow-lg'
                  : 'bg-white/50 border-zinc-200 text-slate-600 hover:bg-white'
              }`}
            >
              All
            </button>
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  categoryFilter === cat
                    ? 'bg-orange-600 text-white border-orange-600 shadow-lg'
                    : 'bg-white/50 border-zinc-200 text-slate-600 hover:bg-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-[40px] overflow-hidden mt-6 flex flex-col min-h-[400px] md:min-h-[520px] ${isFullScreen ? 'hidden' : ''}`}>
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-scroll max-h-[520px] relative scroll-smooth custom-scrollbar-orange">
          <div className="w-full min-w-max">
            {/* Master Header */}
            <div className="flex bg-zinc-900/5 text-zinc-900 backdrop-blur-md sticky top-0 z-40 border-b border-zinc-200/50">
              <div 
                className={`${isDisciplinesFrozen ? 'sticky left-0 z-50 shadow-[2px_0_10px_rgba(0,0,0,0.05)]' : 'relative'} transition-all bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-4 md:p-5 text-left shrink-0 border-r border-b border-zinc-200/50 flex items-center justify-between group/header`}
                style={{ width: disciplinesWidth }}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm md:text-base font-black uppercase tracking-[3px] text-orange-600 select-none">Disciplines</span>
                  
                  {/* Small Manual width controls under title / label */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[7.5px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mr-0.5 select-none font-mono">WIDTH:</span>
                    <button 
                      onClick={() => setDisciplinesWidth(180)}
                      className={`px-2 py-0.5 rounded text-[8.5px] font-black transition-colors ${disciplinesWidth <= 180 ? 'bg-orange-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
                      title="Compact column size (180px)"
                    >
                      S
                    </button>
                    <button 
                      onClick={() => setDisciplinesWidth(280)}
                      className={`px-2 py-0.5 rounded text-[8.5px] font-black transition-colors ${disciplinesWidth > 180 && disciplinesWidth <= 280 ? 'bg-orange-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
                      title="Medium column size (280px)"
                    >
                      M
                    </button>
                    <button 
                      onClick={() => setDisciplinesWidth(380)}
                      className={`px-2 py-0.5 rounded text-[8.5px] font-black transition-colors ${disciplinesWidth > 280 ? 'bg-orange-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
                      title="Wide column size (380px)"
                    >
                      L
                    </button>
                  </div>
                </div>
                
                {/* Freeze/Unfreeze Button */}
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button
                    onClick={() => setIsDisciplinesFrozen(!isDisciplinesFrozen)}
                    className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      isDisciplinesFrozen
                        ? 'bg-orange-100 dark:bg-orange-950/45 text-orange-700 hover:bg-orange-200'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-600'
                    }`}
                    title={isDisciplinesFrozen ? 'Unfreeze columns (allow horizontal scrolling)' : 'Freeze columns (stick on screen)'}
                  >
                    {isDisciplinesFrozen ? <Pin size={11} className="fill-current rotate-45" /> : <PinOff size={11} />}
                    <span className="text-[8px] font-black uppercase tracking-wider leading-none">
                      {isDisciplinesFrozen ? 'Frozen' : 'Unfrozen'}
                    </span>
                  </button>
                </div>

                {/* Resizing drag handle with touch support */}
                <div 
                  onMouseDown={handleResizeMouseDown}
                  onTouchStart={handleTouchStart}
                  className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-orange-500/30 active:bg-orange-600 transition-colors z-[60] flex items-center justify-center group-hover/header:bg-zinc-300/60 dark:group-hover/header:bg-zinc-700/60 touch-none"
                  title="Drag or touch-drag to resize column"
                >
                  <div className="w-[1.5px] h-6 bg-zinc-300 dark:bg-zinc-600 rounded"></div>
                </div>
              </div>
              <div className="flex overflow-visible h-full">
                {daysInMonth.map(day => (
                  <div key={day.toString()} className={`p-4 min-w-[130px] h-[75px] text-center flex flex-col justify-center border-r border-zinc-100 last:border-r-0 ${isToday(day) ? 'bg-orange-500 text-white font-black shadow-lg shadow-orange-500/30 rounded-b-2xl today-cell' : 'hover:bg-zinc-100/50 transition-colors'}`}>
                    <span className="text-[10px] font-black uppercase block mb-0.5 opacity-60 tracking-wider ">{format(day, 'EEE')}</span>
                    <span className="text-sm font-black tracking-tight">{format(day, 'd')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Highly standard and robust mapped matrix to prevent blank screens in mobile APK / Android WebViews */}
            <div className="relative">
              {flattenedItems.length > 0 ? (
                <div className="flex flex-col">
                  {flattenedItems.map((_, index) => (
                    <Row 
                      key={index} 
                      index={index} 
                      style={{ 
                        height: getItemSize(index)
                      }} 
                    />
                  ))}
                </div>
              ) : (
                <div className="py-32 text-center border-b border-zinc-100">
                  <div className="flex flex-col items-center gap-4 text-white/20">
                    <Zap size={64} strokeWidth={1} />
                    <p className="font-black text-[10px] uppercase tracking-[0.2em] italic opacity-40">No habits tracking yet. Click "Mastery Access" to start.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Streak Mastery Trends - Last 90 Days */}
      <div className="mt-12 bg-white/40 backdrop-blur-3xl border border-white/20 rounded-[40px] p-10 shadow-2xl overflow-hidden relative group flex flex-col min-h-[400px] md:min-h-[520px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[120px] -mr-32 -mt-32"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
            <div className="flex items-center gap-4">
               <div className="w-14 h-14 rounded-2xl bg-orange-600 shadow-xl shadow-orange-600/20 flex items-center justify-center text-white font-black text-2xl italic">
                  <Zap size={28} strokeWidth={3} className="animate-pulse" />
               </div>
               <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Streak Mastery <br/>Intelligence</h3>
                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mt-2 font-sans">90-Day Aggregate Performance Review</p>
               </div>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="text-right">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Weekly Avg</span>
                  <span className="text-2xl font-black text-slate-800 tracking-tighter">
                    {Math.round(streakData.slice(-7).reduce((acc, curr) => acc + curr.completions, 0) / 7 * 10) / 10}
                  </span>
               </div>
               <div className="h-10 w-px bg-slate-200"></div>
               <div className="text-right">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peak Load</span>
                  <span className="text-2xl font-black text-emerald-600 tracking-tighter">
                    {Math.max(...streakData.map(d => d.completions))}
                  </span>
               </div>
            </div>
          </div>

          <div className="flex-1 w-full relative z-10 px-2 min-h-[250px] md:min-h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={streakData}>
                   <defs>
                      <linearGradient id="colorStreak" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                      </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                   <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} 
                      interval={7}
                      padding={{ left: 20, right: 20 }}
                   />
                   <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
                      width={30}
                   />
                   <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
                              <div className="flex items-center gap-3">
                                 <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                 <p className="text-lg font-black text-white leading-none">
                                    {payload[0].value} <span className="text-[10px] text-orange-500 uppercase">Disciplines</span>
                                 </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                   />
                   <Area 
                      type="monotone" 
                      dataKey="completions" 
                      stroke="#ea580c" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorStreak)" 
                      animationDuration={2000}
                   />
                </AreaChart>
             </ResponsiveContainer>
          </div>
      </div>

      {/* Styled scrollbar and planning checklist css */}
      <style>{`
        .custom-scrollbar-orange::-webkit-scrollbar {
          height: 10px;
          width: 10px;
        }
        .custom-scrollbar-orange::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 5px;
        }
        .custom-scrollbar-orange::-webkit-scrollbar-thumb {
          background: rgba(249, 115, 22, 0.3);
          border-radius: 5px;
          border: 2px solid rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar-orange::-webkit-scrollbar-thumb:hover {
          background: rgba(249, 115, 22, 0.5);
        }
        .mini-planner-note ul {
          list-style-type: none !important;
          padding-left: 0 !important;
          margin: 0 !important;
        }
        .mini-planner-note li {
          display: flex !important;
          align-items: flex-start !important;
          gap: 4px !important;
          margin: 1px 0 !important;
          padding: 0 !important;
          font-size: 8px !important;
          line-height: 1.15 !important;
        }
        .mini-planner-note .task-checkbox {
          font-size: 8px !important;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 1in !important;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Automatically shrink the wide habit tables to fit custom landscape page widths without clipping */
          .custom-scrollbar-orange {
            transform: scale(0.62) !important;
            transform-origin: top left !important;
            width: 161% !important;
            max-width: none !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          /* Match the container print width to fit within A4 landscape */
          #root {
            width: 100% !important;
            padding: 1in !important;
            box-sizing: border-box !important;
            background: white !important;
          }
          /* Ensure proper breaks */
          .grid, .flex, .habit-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <AnimatePresence>
        {isAddingHabit && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-zinc-950/80 backdrop-blur-xl flex items-start justify-center p-4 overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white w-full max-w-md rounded-[40px] p-8 md:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] my-auto relative border border-zinc-100"
              >
                <button 
                  onClick={() => {
                    setIsAddingHabit(false);
                    setEditingHabitId(null);
                    setNewHabitName('');
                    setNewHabitCategory('');
                    setIsNumericHabit(false);
                    setHabitTargetValue(2);
                    setHabitUnit('liters');
                    setHabitColor('#ea580c');
                  }}
                  className="absolute top-8 right-8 p-3 text-zinc-300 hover:text-zinc-900 transition-all z-10 bg-zinc-50 rounded-2xl hover:bg-zinc-100"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>

                <h3 className="text-2xl md:text-3xl font-black text-zinc-900 mb-8 uppercase italic tracking-tight leading-none">
                  {editingHabitId ? 'Edit' : 'New'} <br/>Mastery Habit
                </h3>
                
                <div className="space-y-6 mb-10 max-h-[70vh] md:max-h-none overflow-y-auto px-1">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block ml-4 font-sans">Identity & Name</label>
                    <input 
                      autoFocus
                      type="text"
                      value={newHabitName}
                      onChange={e => setNewHabitName(e.target.value)}
                      placeholder="e.g., Deep Work Session"
                      className="w-full bg-zinc-50 border-2 border-transparent rounded-[28px] py-6 px-8 text-lg font-black outline-none focus:border-orange-500 focus:bg-white transition-all placeholder:text-zinc-300 shadow-sm"
                      onKeyDown={e => e.key === 'Enter' && handleSaveHabit()}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block ml-4 font-sans">Category</label>
                    <input 
                      type="text"
                      value={newHabitCategory}
                      onChange={e => setNewHabitCategory(e.target.value)}
                      placeholder="e.g., Morning, Health, Work"
                      className="w-full bg-zinc-50 border-2 border-transparent rounded-[28px] py-5 px-8 text-base font-bold outline-none focus:border-orange-500 focus:bg-white transition-all placeholder:text-zinc-300 shadow-sm"
                      onKeyDown={e => e.key === 'Enter' && handleSaveHabit()}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block ml-4 font-sans">Accent Color Style</label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 bg-zinc-50 border border-zinc-100/50 rounded-[24px] p-3 shadow-inner">
                      {HABIT_COLORS.map(c => {
                        const isSelected = habitColor === c.hex;
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            title={c.name}
                            onClick={() => setHabitColor(c.hex)}
                            className="w-8 h-8 rounded-full relative transition-[transform,box-shadow] hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer shadow-sm"
                            style={{ backgroundColor: c.hex }}
                          >
                            {isSelected && (
                              <motion.div 
                                layoutId="activeColorDot"
                                className="w-2.5 h-2.5 rounded-full bg-white shadow-md"
                                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-6 bg-zinc-900/5 rounded-[36px] border border-zinc-100 flex flex-col gap-6 ">
                    <div className="flex items-center justify-between cursor-pointer group px-2" onClick={() => setIsNumericHabit(!isNumericHabit)}>
                      <div>
                        <span className="text-[12px] font-black text-zinc-900 uppercase tracking-tight block">Numerical Tracking</span>
                        <span className="text-[9px] text-zinc-400 font-bold block uppercase tracking-[0.1em] mt-1">Units (liters, reps, km)</span>
                      </div>
                      <div 
                        className={`w-14 h-8 flex items-center rounded-full p-1.5 cursor-pointer transition-all duration-500 ${isNumericHabit ? 'bg-orange-500 shadow-lg shadow-orange-500/20' : 'bg-zinc-200'}`}
                      >
                        <motion.div 
                          animate={{ x: isNumericHabit ? 24 : 0 }}
                          className="bg-white w-5 h-5 rounded-full shadow-md" 
                        />
                      </div>
                    </div>

                    {isNumericHabit && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200/50"
                      >
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block ml-3">Daily Goal</label>
                          <input 
                            type="number"
                            value={habitTargetValue}
                            onChange={e => setHabitTargetValue(Math.max(0.1, parseFloat(e.target.value) || 1))}
                            className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:border-orange-500 transition-all"
                            min="0.1"
                            step="0.5"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block ml-3">Metric Unit</label>
                          <input 
                            type="text"
                            value={habitUnit}
                            onChange={e => setHabitUnit(e.target.value)}
                            placeholder="e.g. km"
                            className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:border-orange-500 transition-all placeholder:text-zinc-300"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setIsAddingHabit(false);
                      setEditingHabitId(null);
                      setNewHabitName('');
                      setNewHabitCategory('');
                      setIsNumericHabit(false);
                      setHabitTargetValue(2);
                      setHabitUnit('liters');
                      setHabitColor('#ea580c');
                    }}
                    className="flex-1 py-5 text-zinc-400 font-black text-[11px] uppercase tracking-[0.2em] hover:text-zinc-900 transition-all"
                  >
                    DISCARD
                  </button>
                  <button 
                    onClick={handleSaveHabit}
                    className="flex-1 bg-gradient-to-br from-orange-600 to-orange-400 text-white rounded-[24px] py-5 font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.03] active:scale-95 transition-all border-b-4 border-orange-800"
                  >
                    {editingHabitId ? 'SAVE CHANGES' : 'CREATE MASTERY HABIT'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
        )}
        {/* Milestone Celebration Overlay Pop-up Modal */}
        {milestoneCelebration && (
          <>
          <ConfettiOverlay streak={milestoneCelebration.streak} habitName={milestoneCelebration.habitName} onComplete={() => {}} />
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-start justify-center p-4 z-[200] select-none overflow-y-auto"
          >
            {/* Visual Confetti / Glitter elements */}
            <div className="absolute inset-0 pointer-events-none opacity-30 overflow-hidden">
              <div className="absolute w-[500px] h-[500px] bg-orange-500/10 rounded-full filter blur-3xl animate-pulse top-0 left-10"></div>
              <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 rounded-full filter blur-3xl animate-pulse bottom-0 right-10"></div>
            </div>

            <motion.div 
              initial={{ scale: 0.85, y: 50, rotate: -2 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.85, y: 50, rotate: 2 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-white rounded-[40px] border border-slate-200 p-8 md:p-12 shadow-2xl max-w-lg w-full text-center relative overflow-hidden my-auto md:my-16"
            >
              <div className="absolute top-0 left-0 w-full h-3" style={{ backgroundColor: milestoneCelebration.color }}></div>
              
              {/* Floating trophy / sparkles inside a circle */}
              <div 
                className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-white mb-6 shadow-lg shadow-current/30 animate-bounce"
                style={{ backgroundColor: milestoneCelebration.color }}
              >
                <Zap size={44} strokeWidth={3} />
              </div>

              <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] block mb-2">Milestone Unlocked</span>
              
              <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-4">
                {milestoneCelebration.streak}-DAY STREAK!
              </h3>
              
              <p className="text-slate-600 font-bold text-base leading-relaxed mb-8 max-w-sm mx-auto">
                Insane dedication! You've maintained your habit <span className="font-black italic px-2 py-0.5 rounded-lg bg-slate-100 text-slate-900">"{milestoneCelebration.habitName}"</span> for {milestoneCelebration.streak} days straight! This architecture of resolve is paying off.
              </p>

              <button
                type="button"
                onClick={() => setMilestoneCelebration(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl shadow-xl hover:scale-[1.03] active:scale-95 transition-all"
              >
                Let's Keep Dominating
              </button>
            </motion.div>
          </motion.div>
          </>
        )}

        {/* Date-specific Habit Note Modal */}
        {editingNoteState && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 select-none"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <p className="text-[9px] font-bold text-orange-600 uppercase tracking-widest mb-1">Habit Daily Notes Context</p>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: editingNoteState.habitColor || '#ea580c' }} />
                    {editingNoteState.habitName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{editingNoteState.date}</p>
                </div>
                <button 
                  onClick={() => setEditingNoteState(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              
              {/* Body */}
              <div className="p-6 flex flex-col gap-4">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Why was this habit goal met or missed?
                </label>
                <textarea
                  className="w-full h-32 p-4 border border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-800 placeholder:text-slate-400 text-sm font-medium resize-none transition-all shadow-inner"
                  placeholder="Provide context e.g., Slept in late so had to rush work, missing the early workout window."
                  value={editingNoteState.noteText}
                  onChange={(e) => setEditingNoteState(prev => prev ? { ...prev, noteText: e.target.value } : null)}
                  autoFocus
                />
              </div>
              
              {/* Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setEditingNoteState(null)}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-100 transition-all font-sans"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const updatedNotes = { ...(data.habitNotes || {}) };
                    if (!updatedNotes[editingNoteState.date]) {
                      updatedNotes[editingNoteState.date] = {};
                    }
                    updatedNotes[editingNoteState.date][editingNoteState.habitId] = editingNoteState.noteText;
                    
                    onUpdate((prev: AppData) => ({
                      ...prev,
                      habitNotes: updatedNotes
                    }));
                    
                    setEditingNoteState(null);
                  }}
                  className="px-6 py-2.5 bg-slate-900 border border-transparent text-white rounded-2xl text-xs font-bold hover:bg-slate-800 hover:-translate-y-0.5 transition-all shadow-lg font-sans"
                >
                  Save Daily Context
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Week Final Confirmation Modal */}
      <AnimatePresence>
        {isResettingWeek && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-zinc-950/80 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl relative border border-zinc-100"
            >
              <div className="space-y-6 mb-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                    <RefreshCw size={32} />
                  </div>
                </div>
                <h3 className="text-xl font-black text-zinc-900 uppercase italic tracking-tight leading-none text-center">Reset Week <br/>Architecture</h3>
                
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select Control Category</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(groupedHabits).sort().map(cat => (
                    <button 
                      key={cat}
                      type="button"
                      onClick={() => setResetTargetCategory(cat)}
                      className={`px-3 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${resetTargetCategory === cat ? 'bg-orange-600 border-orange-600 text-white shadow-lg scale-105' : 'bg-zinc-50 border-zinc-100 text-zinc-400 hover:bg-zinc-100'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[3px] block mb-2">Active Week Context</span>
                  <div className="font-mono text-[10px] text-slate-900 font-bold bg-white p-2 rounded-lg border border-slate-100">
                    {format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} — {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}
                  </div>
                </div>

                <p className="text-[10px] text-zinc-400 font-bold leading-relaxed px-4">
                  Caution: This irreversible protocol will erase all log history for <span className="text-orange-600">"{resetTargetCategory}"</span> within this temporal window.
                </p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsResettingWeek(false)}
                  className="flex-1 py-4 bg-zinc-50 text-zinc-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleResetCategoryWeek}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-600/20"
                >
                  Execute Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {generatedShareLink && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[24px] max-w-md w-full shadow-2xl space-y-4 font-sans">
            <div className="flex items-center gap-3 text-orange-500">
              <Share2 size={24} className="stroke-[2.5]" />
              <h3 className="text-sm font-black tracking-wider uppercase text-slate-800 dark:text-slate-100">Daily Note Share Link Ready</h3>
            </div>
            
            <p className="text-xs text-slate-500">
              Anyone with this link can view and import exactly this Daily Note into their active portal database!
            </p>
            
            <div className="flex items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <input 
                type="text" 
                readOnly 
                value={generatedShareLink} 
                className="flex-1 bg-transparent text-xs text-slate-705 dark:text-slate-300 outline-none select-all truncate pr-2 font-mono"
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(generatedShareLink);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="h-8 px-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-[10px] uppercase font-black tracking-widest rounded-xl transition-all"
              >
                {isCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            
            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setGeneratedShareLink(null)}
                className="h-10 px-5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700/80 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
