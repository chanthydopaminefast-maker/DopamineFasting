
export interface PaperStyleDefinition {
  id: string;
  name: string;
  className: string;
  previewColor: string;
  icon?: string;
}

export const PAPER_STYLES: PaperStyleDefinition[] = [
  { id: 'none', name: 'Clean Glass', className: 'bg-white/85 backdrop-blur-3xl border border-white/30 text-slate-800 shadow-xl', previewColor: 'rgba(255,255,255,0.85)' },
  { id: 'ruled', name: 'Classic Ruled', className: 'paper-ruled shadow-xl', previewColor: '#f8fafc' },
  { id: 'grid', name: 'Math Grid', className: 'paper-grid shadow-xl', previewColor: '#f1f5f9' },
  { id: 'dots', name: 'Bullet Dot', className: 'paper-dots shadow-xl', previewColor: '#f8fafc' },
  { id: 'stars', name: 'Stardust', className: 'paper-stardust shadow-xl text-slate-800', previewColor: '#f5f3ff' },
  { id: 'roses', name: 'Rose Garden', className: 'bg-rose-50 border- rose-200/50 shadow-xl', previewColor: '#fff1f2' },
  { id: 'colorful', name: 'Bright Pop', className: 'bg-white border-8 border-double border-pink-200 ring-8 ring-indigo-50 shadow-2xl', previewColor: '#fdf2f8' },
  { id: 'floral', name: 'Elegant Floral', className: 'bg-[#fafaf9] border-t-8 border-emerald-100 shadow-xl', previewColor: '#f5f5f4' },
  { id: 'engineering', name: 'Engineering', className: 'paper-engineering shadow-xl', previewColor: '#eff6ff' },
  { id: 'kraft', name: 'Cardboard', className: 'bg-[#d2b48c] border-y border-[#b8860b]/20 shadow-inner', previewColor: '#d2b48c' },
  { id: 'lavender', name: 'Lavender Breeze', className: 'bg-purple-50 border-l-8 border-purple-200 shadow-xl', previewColor: '#faf5ff' },
  { id: 'mint', name: 'Mint Leaf', className: 'bg-emerald-50 border-t-8 border-emerald-200 shadow-xl', previewColor: '#ecfdf5' },
  { id: 'retro', name: 'Old Library', className: 'bg-[#f3efdf] border-l-8 border-amber-900/10 shadow-inner', previewColor: '#e9e4d0' },
  { id: 'sky', name: 'Clear Sky', className: 'bg-sky-50 border-b-8 border-sky-100 shadow-xl', previewColor: '#f0f9ff' },
  { id: 'pastel-pink', name: 'Sweet Sakura', className: 'bg-pink-50 border-r-8 border-pink-100 shadow-xl', previewColor: '#fdf2f8' },
  { id: 'parchment', name: 'Scroll', className: 'bg-[#fdf6e3] border-2 border-amber-100 font-serif shadow-xl', previewColor: '#fdf6e3' },
  { id: 'isometric', name: '3D Isometric', className: 'paper-isometric shadow-xl', previewColor: '#ffffff' },
  { id: 'notebook', name: 'Student Spiral', className: 'bg-white border-l-[40px] border-slate-100 shadow-2xl ring-1 ring-slate-200', previewColor: '#ffffff' },
  { id: 'gold-edge', name: 'Prestige Gold', className: 'bg-white border-4 border-amber-200/50 shadow-2xl', previewColor: '#fffbeb' },
  { id: 'zen', name: 'Zen Minimal', className: 'bg-stone-50 border-l-4 border-stone-800 shadow-xl', previewColor: '#f5f5f4' }
];
