import dynamic from 'next/dynamic';

// Dynamically import the recorder so it only loads on the client
const FaceTrackingRecorder = dynamic(() => import('../components/FaceTrackingRecorder'), { ssr: false });

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 flex flex-col items-center justify-center px-2 py-8">
      <div className="w-full max-w-xl bg-white/90 shadow-xl rounded-2xl p-8 flex flex-col items-center border border-gray-200">
        <h1 className="text-4xl font-extrabold text-indigo-700 mb-2 text-center tracking-tight drop-shadow-sm">
          Face Tracking Video Recorder
        </h1>
        <p className="text-gray-600 mb-6 text-center text-lg">
          Record videos with real-time face tracking. Save, download, or delete your recordings easily. Works on desktop and mobile.
        </p>
        <FaceTrackingRecorder />
      </div>
      <footer className="mt-10 text-gray-400 text-xs text-center">
        &copy; {new Date().getFullYear()} Face Tracking App. Powered by Next.js, face-api.js, and Tailwind CSS.
      </footer>
    </main>
  );
}
