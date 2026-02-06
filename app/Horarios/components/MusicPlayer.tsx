'use client';

import { useState, useRef, useEffect } from 'react';

interface Track {
    id: number;
    title: string;
    url: string;
}

interface SimplePlayerProps {
    tracks: Track[];
}

export default function SimpleMusicPlayer({ tracks }: SimplePlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const currentTrack = tracks[currentIndex];

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }

        setIsPlaying(!isPlaying);
    };

    const nextTrack = () => {
        const nextIndex = (currentIndex + 1) % tracks.length;
        setCurrentIndex(nextIndex);
        if (audioRef.current) {
            audioRef.current.src = tracks[nextIndex].url;
            if (isPlaying) audioRef.current.play();
        }
    };

    const prevTrack = () => {
        const prevIndex = currentIndex === 0 ? tracks.length - 1 : currentIndex - 1;
        setCurrentIndex(prevIndex);
        if (audioRef.current) {
            audioRef.current.src = tracks[prevIndex].url;
            if (isPlaying) audioRef.current.play();
        }
    };

    // Cargar canción inicial
    useEffect(() => {
        if (audioRef.current && tracks.length > 0) {
            audioRef.current.src = tracks[0].url;
        }
    }, [tracks]);

    if (tracks.length === 0) {
        return (
            <div className="p-4 text-center text-gray-500">
                No hay canciones disponibles
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center p-4">
            <audio ref={audioRef} />

            <div className="mb-4 text-center">
                <h3 className="font-bold">{currentTrack.title}</h3>
                <p className="text-sm text-gray-600">
                    {currentIndex + 1} / {tracks.length}
                </p>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={prevTrack}
                    className="p-2 hover:bg-gray-100 rounded"
                    disabled={tracks.length <= 1}
                >
                    ⏮️
                </button>

                <button
                    onClick={togglePlay}
                    className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                >
                    {isPlaying ? '⏸️' : '▶️'}
                </button>

                <button
                    onClick={nextTrack}
                    className="p-2 hover:bg-gray-100 rounded"
                    disabled={tracks.length <= 1}
                >
                    ⏭️
                </button>
            </div>
        </div>
    );
}