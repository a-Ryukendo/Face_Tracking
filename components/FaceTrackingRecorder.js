import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

export default function FaceTrackingRecorder() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [savedVideos, setSavedVideos] = useState([]);

    // Convert a Blob to a base64 string for localStorage
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Convert base64 string back to a Blob
  function base64ToBlob(base64) {
    const [header, data] = base64.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(data);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      arr[i] = binary.charCodeAt(i);
    }
    return new Blob([arr], { type: mime });
  };

  // Load face-api.js models (only runs once)
  useEffect(() => {
    async function loadModels() {
      const MODEL_URL = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    }
    loadModels();

    // Restore saved videos from localStorage
    const raw = localStorage.getItem('savedVideos');
    let videos = [];
    try {
      videos = JSON.parse(raw) || [];
    } catch {
      videos = [];
    }
    // Only keep valid ones
    const valid = videos.filter(v => v && typeof v.data === 'string' && v.data.startsWith('data:'));
    setSavedVideos(valid.map(v => ({ ...v, url: URL.createObjectURL(base64ToBlob(v.data)) })));
    // Remove any broken entries
    if (valid.length !== videos.length) {
      localStorage.setItem('savedVideos', JSON.stringify(valid));
    }
  }, []);

  // Start webcam
  useEffect(() => {
    if (!videoRef.current) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        videoRef.current.srcObject = stream;
      });
  }, []);

  // Face detection loop
  useEffect(() => {
    let animationFrameId;
    const detect = async () => {
      if (
        videoRef.current &&
        videoRef.current.readyState === 4 &&
        faceapi.nets.tinyFaceDetector.params &&
        faceapi.nets.faceLandmark68Net.params
      ) {
        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks();
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw the current video frame first
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        // Then draw face overlays
        faceapi.draw.drawDetections(canvas, detections);
        faceapi.draw.drawFaceLandmarks(canvas, detections);
      }
      animationFrameId = requestAnimationFrame(detect);
    };
    detect();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Start recording
  const startRecording = () => {
    const canvasStream = canvasRef.current.captureStream(30);
    const videoStream = videoRef.current.srcObject;
    const audioTracks = videoStream.getAudioTracks();
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioTracks,
    ]);
    const chunks = [];
    const recorder = new window.MediaRecorder(combinedStream, { mimeType: 'video/webm' });
    setMediaRecorder(recorder);
    setRecordedChunks([]);
    recorder.ondataavailable = e => {
      console.log('ondataavailable:', e.data && e.data.size);
      if (e.data.size > 0) chunks.push(e.data);
      // If recording stopped, save
      if (recorder.state === 'inactive') {
        setRecordedChunks(chunks);
        saveRecording(chunks);
      }
    };
    recorder.start();
    setRecording(true);
  };

  // Save video to localStorage as base64
  const saveRecording = async (chunksArg) => {
    const chunksToSave = Array.isArray(chunksArg) ? chunksArg : recordedChunks;
    console.log('Recorded chunks:', chunksToSave);
    if (!chunksToSave || chunksToSave.length === 0) {
      alert('Recording failed: No video data was captured. Please try again.');
      return;
    }
    const blob = new Blob(chunksToSave, { type: 'video/webm' });
    console.log('Blob size:', blob.size);
    if (blob.size === 0) {
      alert('Recording failed: Captured video is empty. Please try again.');
      return;
    }
    const base64 = await blobToBase64(blob);
    const url = URL.createObjectURL(blob);
    const newVideo = { data: base64, date: new Date().toISOString(), url };
    const newVideos = [newVideo, ...savedVideos];
    setSavedVideos(newVideos);
    // Store only base64 and date in localStorage
    const toStore = newVideos.map(({ data, date }) => ({ data, date }));
    localStorage.setItem('savedVideos', JSON.stringify(toStore));
  };


  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder) mediaRecorder.stop();
    setRecording(false);
  };



  // Delete video by index
  const handleDeleteVideo = (idx) => {
    const updated = savedVideos.filter((_, i) => i !== idx);
    setSavedVideos(updated);
    // Only store base64 and date in localStorage
    const toStore = updated.map(({ data, date }) => ({ data, date }));
    localStorage.setItem('savedVideos', JSON.stringify(toStore));
  };

  return (
    <div className="flex flex-col items-center w-full max-w-lg">
      <div className="relative w-full aspect-video bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover rounded-xl"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-xl"
        />
      </div>
      <div className="mt-6 flex gap-6 w-full justify-center">
        {!recording ? (
          <button
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-semibold rounded-lg shadow hover:from-indigo-700 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            onClick={startRecording}
          >
            <span className="inline-block align-middle mr-2">⏺️</span> Start Recording
          </button>
        ) : (
          <button
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-pink-500 text-white font-semibold rounded-lg shadow hover:from-red-700 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
            onClick={stopRecording}
          >
            <span className="inline-block align-middle mr-2">⏹️</span> Stop Recording
          </button>
        )}
      </div>
      <div className="mt-10 w-full bg-white/70 rounded-xl shadow p-4 border border-gray-100">
        <h2 className="text-xl font-bold text-indigo-700 mb-4 text-center tracking-tight">Saved Videos</h2>
        {savedVideos.length === 0 ? (
          <p className="text-gray-400 text-center">No videos saved yet.</p>
        ) : (
          <ul className="space-y-4">
            {savedVideos.map((vid, idx) => (
              <li key={vid.date} className="flex items-center gap-4 bg-gray-50 rounded-lg p-2 shadow-sm border border-gray-100">
                <video src={vid.url} controls className="w-36 h-20 rounded shadow border border-gray-200" />
                <div className="flex flex-col gap-2">
                  <a
                    href={vid.url}
                    download={`face-track-${vid.date}.webm`}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium text-center"
                  >
                    Download
                  </a>
                  <button
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-700 text-sm font-medium text-center"
                    onClick={() => handleDeleteVideo(idx)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
