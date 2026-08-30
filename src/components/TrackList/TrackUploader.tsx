import React, { useState, useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { processAudioFile } from '../../utils/fileHandlers';
import { getAllTracks } from '../../utils/idbStorage';
import { usePlayerStore } from '../../stores/playerStore';

export const TrackUploader: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const setTracks = usePlayerStore(state => state.setTracks);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFiles = useCallback(async (files: FileList) => {
    setIsProcessing(true);
    const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i.test(file.name));
    
    const processedTracks: any[] = [];
    await Promise.all(
      audioFiles.map(async (file) => {
        try {
          const track = await processAudioFile(file);
          processedTracks.push(track);
        } catch (error) {
          console.error('Failed to process file:', file.name, error);
        }
      })
    );

    if (processedTracks.length > 0) {
      const { addTracksBatch } = await import('../../utils/idbStorage');
      await addTracksBatch(processedTracks);
      const allTracks = await getAllTracks();
      setTracks(allTracks);
    }
    setIsProcessing(false);
  }, [setTracks]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
        isDragging ? 'border-primary bg-primary/10' : 'border-secondary hover:border-primary/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        accept="audio/*"
        onChange={handleFileInput}
        className="hidden"
        id="track-upload"
      />
      <label htmlFor="track-upload" className="cursor-pointer flex flex-col items-center gap-4">
        <UploadCloud className="w-12 h-12 text-primary" />
        <div>
          <p className="text-lg font-medium text-foreground">
            {isProcessing ? 'Processing files...' : 'Drag & drop audio files here'}
          </p>
          <p className="text-sm text-gray-400 mt-1">or click to select files</p>
        </div>
      </label>
    </div>
  );
};
