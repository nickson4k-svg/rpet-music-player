import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { usePlayerStore } from '../stores/playerStore';
import { searchAudiusTracks } from '../utils/audiusApi';
import { searchSoundCloud } from '../lib/soundcloud';
import { addTrack, getAllTracks } from '../utils/idbStorage';

interface TakeoutImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportRow {
  Title?: string;
  'Song Title'?: string;
  Artist?: string;
  Album?: string;
  [key: string]: string | undefined;
}

export const TakeoutImportModal: React.FC<TakeoutImportModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    Papa.parse<ImportRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedRows(results.data);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('Помилка при читанні файлу. Переконайтеся, що це валідний .csv файл.');
      }
    });
  };

  const [currentImportName, setCurrentImportName] = useState('');

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    
    setIsImporting(true);
    setProgress(0);
    setSuccessCount(0);
    setErrorCount(0);
    setIsFinished(false);
    
    let successes = 0;
    let errors = 0;

    // Створюємо новий плейлист для цього імпорту
    const playlistId = crypto.randomUUID();
    const newPlaylist: any = {
      id: playlistId,
      name: `Takeout Імпорт (${new Date().toLocaleDateString()})`,
      trackIds: [],
      createdAt: Date.now()
    };
    
    // Якщо файл має назву (наприклад назва плейлиста), використаємо її
    if (file?.name) {
      newPlaylist.name = file.name.replace('.csv', '');
    }

    const playlistTrackIds: string[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      
      // Try to guess the title and artist columns
      const title = row['Song Title'] || row['Title'] || row['Назва'] || row['Song'] || row['Название'] || '';
      const artist = row['Artist'] || row['Виконавець'] || row['Album Artist'] || row['Исполнитель'] || '';
      
      if (!title) {
        errors++;
        setErrorCount(errors);
        setProgress(i + 1);
        continue;
      }
      
      const query = `${title} ${artist}`.trim();
      setCurrentImportName(query);
      
      try {
        let results: any[] = [];
        
        // 1. Шукаємо спочатку в Audius (320 kbps)
        try {
          results = await searchAudiusTracks(query);
        } catch (e) {
          console.log('Audius search failed for:', query);
        }
        
        // 2. Якщо в Audius немає, шукаємо в SoundCloud (128 kbps)
        if (!results || results.length === 0) {
          try {
            const scResults = await searchSoundCloud(query);
            if (scResults && scResults.length > 0) {
              results = scResults.map(t => {
                let transcoding = t.media?.transcodings?.find((tr: any) => tr.format.protocol === 'progressive');
                if (!transcoding && t.media?.transcodings?.length) transcoding = t.media.transcodings[0];
                
                return {
                  id: `soundcloud-${t.id}`,
                  name: t.title,
                  artist: t.user?.username || 'Unknown Artist',
                  album: 'SoundCloud',
                  genre: t.genre || 'Unknown',
                  duration: Math.floor(t.duration / 1000),
                  audioUrl: '',
                  coverUrl: t.artwork_url ? t.artwork_url.replace('-large', '-t500x500') : '',
                  url: transcoding ? `soundcloud:${transcoding.url}` : `soundcloud:${t.id}`,
                  addedAt: Date.now(),
                  playCount: 0
                } as any;
              });
            }
          } catch (e) {
            console.log('SoundCloud fallback failed for:', query);
          }
        }
        
        if (results.length > 0) {
          // Take the best match (first result)
          const track = results[0];
          await addTrack(track as any);
          playlistTrackIds.push(track.id);
          successes++;
          setSuccessCount(successes);
        } else {
          errors++;
          setErrorCount(errors);
        }
      } catch (err) {
        console.error(`Failed to import track: ${query}`, err);
        errors++;
        setErrorCount(errors);
      }
      
      setProgress(i + 1);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Save playlist
    if (playlistTrackIds.length > 0) {
      newPlaylist.trackIds = playlistTrackIds;
      const { addPlaylist } = await import('../utils/idbStorage');
      await addPlaylist(newPlaylist);
      
      // Update store with new playlist
      const state = usePlayerStore.getState();
      state.setPlaylists([...state.playlists, newPlaylist]);
    }
    
    // Refresh the local library
    const updatedTracks = await getAllTracks();
    usePlayerStore.getState().setTracks(updatedTracks);
    
    setIsImporting(false);
    setIsFinished(true);
  };

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setIsImporting(false);
    setProgress(0);
    setSuccessCount(0);
    setErrorCount(0);
    setIsFinished(false);
  };

  const handleClose = () => {
    if (isImporting) {
      const confirm = window.confirm("Імпорт ще триває. Ви дійсно хочете закрити вікно і зупинити процес?");
      if (!confirm) return;
    }
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-bg-secondary w-full max-w-lg rounded-2xl shadow-2xl border border-secondary/20 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-secondary/20 flex items-center justify-between bg-bg-tertiary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <Upload className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Імпорт з YouTube Music</h2>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-secondary/50 rounded-full transition-colors text-foreground-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!file ? (
            <div 
              className="border-2 border-dashed border-secondary/50 rounded-2xl p-8 text-center hover:bg-secondary/10 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4 group-hover:text-accent transition-colors" />
              <h3 className="text-lg font-semibold text-white mb-2">Завантажити файл .csv</h3>
              <p className="text-sm text-gray-400 mb-4 max-w-xs mx-auto">
                Розархівуйте ваш Google Takeout та знайдіть файл <strong>music-library-songs.csv</strong> або будь-який інший плейлист у форматі CSV.
              </p>
              <button className="bg-secondary text-white px-6 py-2 rounded-full font-medium hover:bg-secondary/80 transition-colors">
                Вибрати файл
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".csv" 
                className="hidden" 
              />
            </div>
          ) : !isImporting && !isFinished ? (
            <div className="space-y-6">
              <div className="bg-bg-tertiary p-4 rounded-xl flex items-center gap-4">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-sm text-gray-400">Знайдено {parsedRows.length} треків</p>
                </div>
                <button 
                  onClick={reset}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors p-2"
                >
                  Змінити
                </button>
              </div>
              
              <div className="bg-accent/10 border border-accent/20 p-4 rounded-xl text-sm text-accent/90">
                <p>Процес може зайняти певний час (приблизно 1 секунда на кожен трек), щоб уникнути блокування API. Не закривайте це вікно.</p>
              </div>

              <button 
                onClick={handleImport}
                className="w-full bg-accent text-bg-primary font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Почати імпорт
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                {isFinished ? (
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                ) : (
                  <Loader2 className="w-16 h-16 text-accent animate-spin mx-auto mb-4" />
                )}
                <h3 className="text-xl font-bold text-white mb-2">
                  {isFinished ? 'Імпорт завершено!' : 'Шукаємо та зберігаємо треки...'}
                </h3>
                <p className="text-gray-400">
                  Оброблено {progress} з {parsedRows.length}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="h-3 bg-secondary/30 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${(progress / parsedRows.length) * 100}%` }}
                />
              </div>
              
              {!isFinished && currentImportName && (
                <p className="text-sm text-gray-400 text-center mb-6 truncate px-4">
                  Шукаю: <span className="text-white font-medium">{currentImportName}</span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-bg-tertiary p-4 rounded-xl text-center">
                  <p className="text-sm text-gray-400 mb-1">Успішно знайдено</p>
                  <p className="text-2xl font-bold text-green-400">{successCount}</p>
                </div>
                <div className="bg-bg-tertiary p-4 rounded-xl text-center">
                  <p className="text-sm text-gray-400 mb-1">Не знайдено</p>
                  <p className="text-2xl font-bold text-red-400">{errorCount}</p>
                </div>
              </div>

              {isFinished && (
                <button 
                  onClick={handleClose}
                  className="w-full bg-secondary text-white font-bold py-3 rounded-xl hover:bg-secondary/80 transition-colors"
                >
                  Готово
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
