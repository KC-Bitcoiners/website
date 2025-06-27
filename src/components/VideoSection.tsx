import React from "react";

interface VideoSectionProps {
  title: string;
  videoUrl: string;
  videoTitle?: string;
  backgroundColor?: "white" | "gray";
}

export default function VideoSection({
  title,
  videoUrl,
  videoTitle = "Video",
  backgroundColor = "gray",
}: VideoSectionProps) {
  const bgClass = backgroundColor === "white" ? "bg-white" : "bg-gray-100";

  return (
    <section className={`${bgClass} py-16`}>
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto text-center mb-10">
          <h2 className="text-4xl font-bold bitcoin-orange mb-8 font-archivo-black">
            {title}
          </h2>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
              src={videoUrl}
              frameBorder="0"
              allow="fullscreen"
              allowFullScreen
              title={videoTitle}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
