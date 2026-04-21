import React, { useEffect, useRef } from "react";
import Hls from "hls.js";
import { Livestream } from "@/utils/livestreams";

interface LivestreamPlayerProps {
  streams: Livestream[];
}

export default function LivestreamPlayer({ streams }: LivestreamPlayerProps) {
  if (streams.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
        </span>
        <h2 className="text-xl font-bold font-archivo-black">Live Now</h2>
      </div>
      <div className="grid gap-4">
        {streams.map((stream) => (
          <StreamCard key={stream.id} stream={stream} />
        ))}
      </div>
    </div>
  );
}

function StreamCard({ stream }: { stream: Livestream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream.streamingUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(stream.streamingUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      video.src = stream.streamingUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      });
    }
  }, [stream.streamingUrl]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex flex-col md:flex-row">
        {/* Video player */}
        <div className="md:w-2/3 bg-black">
          <video
            ref={videoRef}
            className="w-full aspect-video"
            controls
            playsInline
            muted
            poster={stream.image || undefined}
          />
        </div>

        {/* Stream info */}
        <div className="md:w-1/3 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
                <span className="h-1.5 w-1.5 bg-red-600 rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
            <h3 className="font-bold text-lg mb-1">{stream.title}</h3>
            {stream.summary && (
              <p className="text-gray-600 text-sm line-clamp-3">
                {stream.summary}
              </p>
            )}
          </div>

          <div className="mt-4 text-xs text-gray-400">
            Host: {stream.host.pubkey.slice(0, 12)}...
          </div>
        </div>
      </div>
    </div>
  );
}
