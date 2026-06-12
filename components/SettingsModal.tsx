import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, CurrentUser, AppData } from '../types';
import { X, Save, Settings2, Type, Baseline, Paintbrush, Check, Cloud, LogIn, LogOut, Image as ImageIcon, Trash2, FileText, Coins, Table, Download, Upload } from 'lucide-react';
import { PAPER_STYLES } from '../src/styles/paperStyles';
import { signInWithEmailAndPassword, auth } from '../services/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings?: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  currentUser?: CurrentUser | null;
  onLogin?: () => void;
  onPhoneLogin?: (user: any) => void;
  onLogout?: () => void;
  appData?: AppData;
  onImportData?: (importedData: AppData) => void;
}

const fontFamilies = [
  { name: 'System Default', value: 'ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { name: 'Modern', value: '"Inter", sans-serif' },
  { name: 'Technical', value: '"JetBrains Mono", monospace' },
  { name: 'Elegant Serif', value: '"Playfair Display", serif' },
  { name: 'Playful', value: '"Comic Neue", "Comic Sans MS", cursive, sans-serif' },
  { name: 'Handwriting', value: '"Caveat", "Dancing Script", cursive' }
];

const colors = [
  { name: 'Default Dark', value: '#0f172a' },
  { name: 'Slate', value: '#334155' },
  { name: 'Midnight Blue', value: '#1e3a8a' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Rose', value: '#be123c' },
  { name: 'Amber', value: '#b45309' },
];

const WALLPAPER_PRESETS = [
  { name: 'Calm Oceanside Tracker', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Ethereal Forest Mist', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Nebula Starlight Cosmic', url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Warm Minimalist Abstract', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Classic Japanese Washi Accent', url: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Serene Peak Sunrise Theme', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Lofi Cozy Coffee Workspace', url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=2000' },
  { name: 'Minimal Solid Slate Dark', url: 'https://images.unsplash.com/photo-1533035353720-f1c6a75cd8ab?auto=format&fit=crop&q=80&w=2000' }
];

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, onUpdate, currentUser, onLogin, onPhoneLogin, onLogout, appData, onImportData }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  
  const [localSettings, setLocalSettings] = useState<AppSettings>({
    fontFamily: settings?.fontFamily || 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontSize: settings?.fontSize || 16,
    textFontFamily: settings?.textFontFamily || 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    textFontSize: settings?.textFontSize || 16,
    fontColor: settings?.fontColor || '#0f172a',
    appBackgroundColor: settings?.appBackgroundColor || '',
    dateTextColor: settings?.dateTextColor || '#f97316',
    currency: settings?.currency || 'USD',
    exchangeRate: settings?.exchangeRate || 4000,
    backgroundImage: settings?.backgroundImage,
    backgroundImageBlur: settings?.backgroundImageBlur || 0,
    backgroundDimOpacity: settings?.backgroundDimOpacity !== undefined ? settings.backgroundDimOpacity : 20,
    paperStyle: settings?.paperStyle || 'none',
    tableBorderThickness: settings?.tableBorderThickness || 2,
    tableBorderColor: settings?.tableBorderColor || '#334155'
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const handleDownloadJSON = () => {
    if (!appData) return;
    try {
      const json = JSON.stringify(appData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      const date = new Date().toISOString().split('T')[0];
      downloadAnchor.download = `growth-portal-backup-${date}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert("Error generating manual backup file");
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportSuccess('');
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!parsed || (typeof parsed !== 'object')) {
            throw new Error("Invalid file content. Must be a valid JSON object.");
          }
          if (!Array.isArray(parsed.students)) {
            throw new Error("Invalid schema: 'students' field is required and must be an array.");
          }
          
          if (onImportData) {
            onImportData(parsed);
            setImportSuccess("Backup imported successfully! Applying changes...");
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          }
        } catch (err: any) {
          console.error(err);
          setImportError(err.message || "Failed to parse JSON backup file.");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleEmailPasswordAction = async () => {
    setEmailError('');
    setIsEmailLoading(true);
    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('../services/firebase');
      if (isSignUpMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // Do not call onLogin() here because onLogin maps to signInWithGoogle.
      // onAuthStateChanged in App.tsx will automatically pick up the login state change.
    } catch (error: any) {
      console.error(error);
      setEmailError(error.message || `Error ${isSignUpMode ? 'signing up' : 'signing in'} with Email/Password`);
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleSave = () => {
    onUpdate({ ...settings, ...localSettings });
    onClose();
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLocalSettings(prev => ({
          ...prev,
          backgroundImage: event.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 z-[60] flex items-center justify-center backdrop-blur-md">
      <div className="bg-white/90 backdrop-blur-xl border border-white/40 rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/20 flex justify-between items-center bg-slate-900/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-xl text-white">
                 <Settings2 size={18} />
              </div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none">System Control</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors text-slate-500">
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar scroll-smooth">

            {/* Cloud Sync */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-2">
                    <Cloud size={18} className="text-orange-500" />
                    <h3 className="tracking-wide">Cloud Sync</h3>
                </div>

                <div className="bg-white/50 border border-white/60 p-4 rounded-2xl space-y-4 shadow-sm flex flex-col items-center text-center">
                    {currentUser?.uid ? (
                        <>
                          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                            <Check size={24} strokeWidth={3} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 mb-1">Synced & Backed Up</p>
                            {currentUser?.email && <p className="text-[10px] font-bold text-orange-600 mb-1 break-all tracking-tight">{currentUser.email}</p>}
                            <p className="text-xs text-slate-500 leading-relaxed mb-4">
                              Your data is automatically syncing across all devices.
                            </p>
                            <button 
                              onClick={onLogout}
                              className="px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50 hover:text-red-500 transition-colors font-bold text-xs flex items-center gap-2 mx-auto"
                            >
                              <LogOut size={14} /> Sign Out
                            </button>
                          </div>
                        </>
                    ) : (
                        <>
                          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-2">
                            <Cloud size={24} strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 mb-1">Local Mode</p>
                            <p className="text-xs text-slate-500 leading-relaxed mb-4">
                              Your data is only stored in this browser. Please sign in to sync.
                            </p>
                            <button 
                              onClick={() => { if(onLogin) onLogin(); }}
                              className="px-6 w-full py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-500/30 transition-all font-black uppercase text-xs flex items-center justify-center gap-2 mb-4"
                            >
                              <LogIn size={16} /> Google Sign In
                            </button>
                            <div className="relative mb-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
                                    <span className="bg-white/50 px-2">OR</span>
                                </div>
                            </div>
                            {emailError && (
                              <div className="mb-4 bg-red-50 text-red-600 border border-red-200 p-3 rounded-xl text-xs font-medium text-left leading-tight shadow-sm">
                                {emailError}
                              </div>
                            )}
                             <div className="space-y-4 mb-4">
                               <input 
                                 type="email"
                                 className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400"
                                 placeholder="Email"
                                 value={email}
                                 onChange={(e) => setEmail(e.target.value)}
                                 disabled={isEmailLoading}
                               />
                               <input 
                                 type="password"
                                 className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400"
                                 placeholder="Password"
                                 value={password}
                                 onChange={(e) => setPassword(e.target.value)}
                                 disabled={isEmailLoading}
                               />
                               <button 
                                 onClick={handleEmailPasswordAction}
                                 disabled={isEmailLoading || !email || !password}
                                 className="px-6 w-full py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 shadow-lg transition-all font-black uppercase text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                               >
                                 {isEmailLoading ? (
                                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                 ) : (
                                   <LogIn size={16} />
                                 )}
                                 {isSignUpMode ? 'Sign Up' : 'Sign In'} with Email
                               </button>
                               <div className="text-center">
                                  <button
                                     onClick={() => setIsSignUpMode(!isSignUpMode)}
                                     className="text-xs text-orange-600 hover:text-orange-700 font-bold underline"
                                  >
                                    {isSignUpMode ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                                  </button>
                               </div>
                            </div>
                          </div>
                        </>
                    )}
                </div>
            </div>

            {/* Manual Backup & Restore */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-2">
                    <Download size={18} className="text-orange-500" />
                    <h3 className="tracking-wide">Manual Backup</h3>
                </div>

                <div className="bg-white/50 border border-white/60 p-4 rounded-2xl space-y-4 shadow-sm flex flex-col items-center">
                    <p className="text-xs text-slate-500 leading-relaxed text-center">
                        Keep an independent JSON copy of your Growth Portal data locally on your computer or device.
                    </p>
                    
                    <button 
                      onClick={handleDownloadJSON}
                      className="px-6 w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all font-black uppercase text-xs flex items-center justify-center gap-2"
                    >
                      <Download size={16} /> Download JSON Backup
                    </button>

                    <div className="relative w-full">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 bg-transparent">
                            <span className="bg-white/90 px-2 rounded">Restore</span>
                        </div>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-tight text-center">
                        Import a previously downloaded `.json` system backup file to restore your settings, student records, and custom progress data.
                        <br/><span className="text-orange-500 font-bold mt-1 inline-block">Note: To import separate Topic Folders, use the "Import" button directly in the Note-taking or Self-learning tabs.</span>
                    </p>

                    {importError && (
                      <div className="w-full bg-red-50 text-red-600 border border-red-200 p-2.5 rounded-xl text-xs font-semibold leading-tight text-center">
                        {importError}
                      </div>
                    )}

                    {importSuccess && (
                      <div className="w-full bg-green-50 text-green-600 border border-green-200 p-2.5 rounded-xl text-xs font-semibold leading-tight text-center">
                        {importSuccess}
                      </div>
                    )}

                    <button 
                      onClick={() => importFileRef.current?.click()}
                      className="px-6 w-full py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all font-black uppercase text-xs flex items-center justify-center gap-2"
                    >
                      <Upload size={16} /> Import Backup File
                    </button>
                    <input 
                      type="file" 
                      ref={importFileRef} 
                      onChange={handleImportJSON} 
                      className="hidden" 
                      accept=".json" 
                    />
                </div>
            </div>
            
            {/* Interface Font settings */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-2">
                    <Baseline size={18} className="text-orange-500" />
                    <h3 className="tracking-wide">Interface Theme</h3>
                </div>

                <div className="bg-white/50 border border-white/60 p-4 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Interface Font</label>
                        <select 
                            value={localSettings.fontFamily}
                            onChange={(e) => setLocalSettings(prev => ({...prev, fontFamily: e.target.value}))}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-slate-700"
                        >
                            {fontFamilies.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center pl-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global scale</label>
                            <span className="text-xs font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">{localSettings.fontSize}px</span>
                        </div>
                        <input 
                            type="range" min="12" max="24" 
                            value={localSettings.fontSize} 
                            onChange={(e) => setLocalSettings(prev => ({...prev, fontSize: parseInt(e.target.value)}))}
                            className="w-full accent-orange-500 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Content Font settings */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-2">
                    <Type size={18} className="text-blue-500" />
                    <h3 className="tracking-wide">Content Typography</h3>
                </div>

                <div className="bg-white/50 border border-white/60 p-4 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Document & Note Font</label>
                        <select 
                            value={localSettings.textFontFamily}
                            onChange={(e) => setLocalSettings(prev => ({...prev, textFontFamily: e.target.value}))}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-slate-700"
                        >
                            {fontFamilies.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center pl-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Note Text size</label>
                            <span className="text-xs font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">{localSettings.textFontSize}px</span>
                        </div>
                        <input 
                            type="range" min="12" max="44" 
                            value={localSettings.textFontSize} 
                            onChange={(e) => setLocalSettings(prev => ({...prev, textFontSize: parseInt(e.target.value)}))}
                            className="w-full accent-blue-500 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Colors */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-2">
                    <Paintbrush size={18} className="text-orange-500" />
                    <h3 className="tracking-wide">Theme Colors</h3>
                </div>

                <div className="bg-white/50 border border-white/60 p-4 rounded-2xl shadow-sm space-y-4">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">Global App Text Color</p>
                        <div className="flex flex-wrap gap-3">
                            {colors.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => setLocalSettings(prev => ({...prev, fontColor: c.value}))}
                                    className={`w-10 h-10 rounded-xl border-2 transition-all hover:scale-110 shadow-sm flex items-center justify-center ${localSettings.fontColor === c.value ? 'border-orange-500 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                >
                                    {localSettings.fontColor === c.value && <Check size={16} className="text-white mix-blend-overlay" />}
                                </button>
                            ))}
                            <input 
                                type="color" 
                                value={localSettings.fontColor} 
                                onChange={(e) => setLocalSettings(prev => ({...prev, fontColor: e.target.value}))} 
                                className="w-10 h-10 rounded-xl border-2 border-slate-200 cursor-pointer" 
                                title="Custom Text Color"
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">App Background Color</p>
                        <div className="flex flex-wrap gap-3">
                            <input 
                                type="color" 
                                value={localSettings.appBackgroundColor || '#ffffff'} 
                                onChange={(e) => setLocalSettings(prev => ({...prev, appBackgroundColor: e.target.value}))} 
                                className="w-full h-10 rounded-xl border-2 border-slate-200 cursor-pointer" 
                                title="Custom Background Color"
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">Global Date Text Color</p>
                        <div className="flex flex-wrap gap-3">
                            <input 
                                type="color" 
                                value={localSettings.dateTextColor} 
                                onChange={(e) => setLocalSettings(prev => ({...prev, dateTextColor: e.target.value}))} 
                                className="w-full h-10 rounded-xl border-2 border-slate-200 cursor-pointer" 
                                title="Custom Date Text Color"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Paper Selection */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-2">
                    <FileText size={18} className="text-indigo-500" />
                    <h3 className="tracking-wide">Note Paper Style</h3>
                </div>

                <div className="bg-white/50 border border-white/60 p-4 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">Select Canvas Texture (20 Styles)</p>
                    <div className="grid grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {PAPER_STYLES.map(style => (
                            <button
                                key={style.id}
                                onClick={() => setLocalSettings(prev => ({...prev, paperStyle: style.id}))}
                                className={`group relative h-16 rounded-xl border-2 transition-all hover:-translate-y-1 shadow-sm overflow-hidden ${localSettings.paperStyle === style.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-indigo-300'}`}
                                title={style.name}
                            >
                                <div className={`absolute inset-0 ${style.className} flex items-center justify-center`}>
                                    {localSettings.paperStyle === style.id && (
                                        <div className="bg-indigo-600 text-white rounded-full p-1 shadow-lg">
                                            <Check size={12} />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm py-0.5 text-[7px] font-black uppercase text-white tracking-widest text-center">
                                    {style.name}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table Grid Settings */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-2">
                    <Table size={18} className="text-orange-500" />
                    <h3 className="tracking-wide text-slate-800">Table & Grid Lines</h3>
                </div>

                <div className="bg-white/50 border border-white/60 p-4 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center pl-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Border Thickness</label>
                            <span className="text-xs font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">{(localSettings as any).tableBorderThickness || 2}px</span>
                        </div>
                        <input 
                            type="range" min="1" max="8" 
                            value={(localSettings as any).tableBorderThickness || 2} 
                            onChange={(e) => setLocalSettings(prev => ({...prev, tableBorderThickness: parseInt(e.target.value)}))}
                            className="w-full accent-orange-500 cursor-pointer"
                        />
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Grid Color / Visibility</p>
                        <select 
                            value={(localSettings as any).tableBorderColor || '#334155'}
                            onChange={(e) => setLocalSettings(prev => ({...prev, tableBorderColor: e.target.value}))}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-slate-700"
                        >
                            <option value="#000000">Deep Black (Ultra High Contrast)</option>
                            <option value="#334155">Dark Blue-Slate (Standard high contrast)</option>
                            <option value="#475569">Slate Gray (Medium contrast)</option>
                            <option value="#94a3b8">Soft Gray (Lighter)</option>
                            <option value="#cbd5e1">Delicate Ghost Gray (Very Light)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Background Customization */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-2">
                    <ImageIcon size={18} className="text-emerald-500" />
                    <h3 className="tracking-wide">Wallpaper & Readability</h3>
                </div>

                <div className="bg-white/50 border border-white/60 p-4 rounded-2xl space-y-4 shadow-sm">
                    {/* Preset wallpapers selection */}
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 mb-2">Preset Wallpapers</p>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 no-scrollbar border border-slate-200/50 p-1.5 rounded-xl bg-white/40">
                            {WALLPAPER_PRESETS.map((preset) => {
                                const isActive = localSettings.backgroundImage === preset.url;
                                return (
                                    <button
                                        type="button"
                                        key={preset.name}
                                        onClick={() => setLocalSettings(prev => ({ ...prev, backgroundImage: preset.url }))}
                                        className={`group relative h-14 rounded-lg overflow-hidden border text-left transition-all ${isActive ? 'ring-2 ring-emerald-500 border-transparent shadow shadow-emerald-500/20' : 'border-slate-200/60 hover:border-slate-300'}`}
                                    >
                                        <img src={preset.url} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={preset.name} />
                                        <div className="absolute inset-0 bg-slate-905/40 group-hover:bg-slate-905/30 transition-colors" />
                                        <div className="absolute bottom-1 left-1.5 right-1.5">
                                            <p className="text-[9px] font-black text-white leading-tight truncate drop-shadow-sm">{preset.name}</p>
                                        </div>
                                        {isActive && (
                                            <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                                <Check size={10} strokeWidth={3} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1">Custom Background Wallpaper</p>
                    <div className="flex gap-3">
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all text-xs font-bold shadow-sm"
                        >
                            <ImageIcon size={14} className="text-indigo-500" /> Upload Custom Photo
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
                        
                        {localSettings.backgroundImage && (
                            <button 
                                type="button"
                                onClick={() => setLocalSettings(prev => ({ ...prev, backgroundImage: undefined }))}
                                className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                                title="Remove Background"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>

                    {localSettings.backgroundImage && (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 h-16 bg-slate-100">
                            <img src={localSettings.backgroundImage} className="w-full h-full object-cover" alt="Preview" />
                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                <span className="text-[8px] font-black uppercase text-white bg-black/45 px-2 py-0.5 rounded backdrop-blur-sm">Active Background</span>
                            </div>
                        </div>
                    )}

                    {/* Background Readability Sliders */}
                    <div className="border-t border-slate-200/50 pt-3 space-y-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Adjust For Perfect Readability</p>
                        
                        {/* Background Dimming Opacity slider */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-600 pl-1">
                                <span>Dimming Overlay (Darken)</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-700 font-extrabold">{localSettings.backgroundDimOpacity ?? 20}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={localSettings.backgroundDimOpacity ?? 20}
                                onChange={(e) => setLocalSettings(prev => ({ ...prev, backgroundDimOpacity: parseInt(e.target.value) }))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <p className="text-[9px] text-slate-400 pl-1 leading-tight">Darkens the background. Set to 50% or more for maximum text contrast.</p>
                        </div>

                        {/* Background Blur px slider */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-600 pl-1">
                                <span>Background Blur Depth</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-700 font-extrabold">{localSettings.backgroundImageBlur ?? 0}px</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="24" 
                                value={localSettings.backgroundImageBlur ?? 0}
                                onChange={(e) => setLocalSettings(prev => ({ ...prev, backgroundImageBlur: parseInt(e.target.value) }))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <p className="text-[9px] text-slate-400 pl-1 leading-tight">Dissolves complex wallpaper details so you can focus entirely on your words.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Settings */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black mb-2">
                    <Coins size={18} className="text-orange-500 animate-pulse" />
                    <h3 className="tracking-wide">Currency & Rate Settings</h3>
                </div>

                <div className="bg-white/50 border border-white/60 p-4 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Default Base Currency</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setLocalSettings(prev => ({...prev, currency: 'USD'}))}
                                className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider border transition-all ${localSettings.currency === 'USD' ? 'bg-orange-500 text-white border-transparent shadow shadow-orange-500/25' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                💵 USD ($)
                            </button>
                            <button
                                type="button"
                                onClick={() => setLocalSettings(prev => ({...prev, currency: 'KHR'}))}
                                className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider border transition-all ${localSettings.currency === 'KHR' ? 'bg-orange-500 text-white border-transparent shadow shadow-orange-500/25' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                🇰🇭 KHR (Riel)
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/50">
                        <div className="flex justify-between items-center pl-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Exchange Rate (1 USD = ? Riels)</label>
                            <span className="text-xs font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">
                                {localSettings.exchangeRate?.toLocaleString()} Riels
                            </span>
                        </div>
                        <input
                            type="number"
                            min="1000"
                            max="10000"
                            step="100"
                            value={localSettings.exchangeRate}
                            onChange={(e) => setLocalSettings(prev => ({...prev, exchangeRate: parseInt(e.target.value) || 4000}))}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-slate-800"
                            placeholder="KHR per 1 USD (e.g., 4000)"
                        />
                        <p className="text-[9.5px] font-bold text-slate-400 italic pl-1 leading-relaxed">
                            This custom exchange rate is used to convert and present transaction amounts when viewing stats or filtering. Default is 4,000 Riels per Dollar.
                        </p>
                    </div>
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/20 bg-slate-900/5">
            <button 
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-black text-sm tracking-wide shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5"
            >
                <Save size={18} /> Apply Changes
            </button>
        </div>

      </div>
    </div>
  );
};
