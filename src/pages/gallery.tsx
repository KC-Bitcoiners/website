import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Head from "next/head";
import { handleBrokenMedia } from "blossom-client-sdk";
import { config, siteConfig, basePath } from "@/config";
import {
  streamGalleryImages,
  GalleryImage,
  publishGalleryImage,
  uploadToBlossom,
  getBlossomServers,
} from "@/utils/galleryEvents";
import { buildDeleteEvent, publishDelete } from "@/utils/pinboardEvents";
import { useNostr } from "@/contexts/NostrContext";
import EventActions from "@/components/EventActions";
import { useModal } from "@/hooks/useModal";
import { fetchZapTotal } from "@/utils/zaps";

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    caption: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { user, hasExtension, loginWithExtension, signEvent } = useNostr();
  const mediaRootRef = useRef<HTMLDivElement>(null);

  // Sort controls
  const [sortBy, setSortBy] = useState<"zaps" | "date">("zaps");
  const [zapTotals, setZapTotals] = useState<Record<string, number>>({});

  // Modal accessibility: Escape key + scroll lock
  const closeImageModal = useCallback(() => setSelectedImage(null), []);
  const closeUploadModal = useCallback(() => setShowUploadModal(false), []);
  useModal(!!selectedImage, closeImageModal);
  useModal(showUploadModal, closeUploadModal);

  useEffect(() => {
    const stream = streamGalleryImages((image) => {
      setImages((prev) => {
        if (prev.some((i) => i.id === image.id)) return prev;
        return [...prev, image].sort((a, b) => b.created_at - a.created_at);
      });
    });
    const timer = setTimeout(() => {
      setLoading(false);
      stream.cancel();
    }, 30000);
    return () => {
      clearTimeout(timer);
      stream.cancel();
    };
  }, []);

  // Fetch zap totals for gallery images
  useEffect(() => {
    if (images.length === 0) return;
    let cancelled = false;
    const totals: Record<string, number> = {};
    Promise.all(
      images.map((img) =>
        fetchZapTotal(img.id, img.pubkey).then((t) => { if (t > 0) totals[img.id] = t; }),
      ),
    ).then(() => { if (!cancelled) setZapTotals(totals); });
    return () => { cancelled = true; };
  }, [images]);

  // Compute sorted images
  const sortedImages = useMemo(() => {
    return [...images].sort((a, b) => {
      if (sortBy === "zaps") return (zapTotals[b.id] || 0) - (zapTotals[a.id] || 0);
      return b.created_at - a.created_at;
    });
  }, [images, sortBy, zapTotals]);

  // Auto-fallback for broken <img> elements via blossom-client-sdk: when an
  // image fails to load, the SDK looks up the author's kind 10063 server list
  // and tries each server in order. Also handles `blossom:` URI src values.
  useEffect(() => {
    if (!mediaRootRef.current) return;
    return handleBrokenMedia(mediaRootRef.current, getBlossomServers);
  }, []);

  const handleDeleteImage = useCallback(async (image: GalleryImage) => {
    if (!user || user.pubkey !== image.pubkey) return;
    setImages((prev) => prev.filter((i) => i.id !== image.id));
    setSelectedImage((prev) => (prev?.id === image.id ? null : prev));
    const unsignedDelete = buildDeleteEvent({ eventId: image.id, eventKind: image.kind, reason: "Deleted by author" });
    const signedDelete = await signEvent(unsignedDelete as { kind: number; content: string; tags: string[][]; created_at: number });
    await publishDelete(signedDelete);
  }, [user, signEvent]);

  const handleUploadSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);
    try {
      if (!uploadForm.file || !uploadForm.caption) throw new Error("Please fill in all fields");
      if (!user) throw new Error("You must be logged in to upload");
      const imageUrl = await uploadToBlossom(uploadForm.file, signEvent);
      const result = await publishGalleryImage(imageUrl, uploadForm.caption, signEvent, user.pubkey);
      if (!result.success) throw new Error(result.error || "Failed to upload");
      const newImage: GalleryImage = {
        id: result.eventId || `local-${Date.now()}`,
        kind: 20,
        pubkey: user.pubkey,
        tags: [["imeta", `url ${imageUrl} m image/jpeg alt ${uploadForm.caption}`]],
        content: uploadForm.caption,
        imageUrl,
        caption: uploadForm.caption,
        created_at: Math.floor(Date.now() / 1000),
      };
      setImages((prev) => (prev.some((i) => i.id === newImage.id) ? prev : [newImage, ...prev]));
      setShowUploadModal(false);
      setUploadForm({ file: null, caption: "" });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload");
    } finally {
      setUploading(false);
    }
  }, [uploadForm, user, signEvent]);

  return (
    <>
      <Head>
        <title>{config.pages.gallery.meta.title}</title>
        <meta
          name="description"
          content={config.pages.gallery.meta.description}
        />
        <link rel="icon" href={`${basePath}/favicon.ico`} />
      </Head>

      <div className="container mx-auto px-4 py-6" data-testid="gallery-page" ref={mediaRootRef}>
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold font-archivo-black text-gray-900">
              Event Photos
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Sort:</span>
                {(["zaps", "date"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      sortBy === s
                        ? "bg-gray-800 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s === "zaps" ? "\u26A1 Zaps" : "Newest"}
                  </button>
                ))}
              </div>
              <button
                data-testid="add-photo-btn"
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-bitcoin-orange text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
              >
                Add Photo
              </button>
            </div>
          </div>

          {loading && images.length === 0 && (
            <div className="text-center" data-testid="gallery-loading">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bitcoin-orange mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Loading Gallery
                </h3>
                <p className="text-gray-600">
                  Connecting to Nostr to load images...
                </p>
              </div>
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sortedImages.map((image) => (
                <div
                  key={image.id}
                  data-testid={`gallery-image-${image.id.slice(0, 8)}`}
                  className="cursor-pointer"
                  onClick={() => setSelectedImage(image)}
                >
                  <img
                    src={image.imageUrl}
                    data-pubkey={image.pubkey}
                    alt={image.caption || "Gallery image"}
                    width={400}
                    height={256}
                    className="w-full h-64 object-cover rounded-lg bg-gray-100"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      {image.caption && (
                        <p className="mt-2 text-sm text-gray-700">
                          {image.caption}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(image.created_at * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <EventActions
                        event={image as unknown as Record<string, unknown>}
                        signEvent={signEvent}
                        pubkey={user?.pubkey}
                        onDelete={
                          user && user.pubkey === image.pubkey
                            ? () => handleDeleteImage(image)
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && images.length === 0 && (
            <div
              className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center"
              data-testid="gallery-empty"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Images Yet
              </h3>
              <p className="text-gray-600 mb-4">
                Check back soon for photos from our events!
              </p>
            </div>
          )}

          {loading && images.length > 0 && (
            <div className="flex justify-center items-center py-4 gap-2 text-sm text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
              Loading more...
            </div>
          )}
        </div>

        {/* Image Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-5xl max-h-[90vh]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(null);
                }}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <img
                src={selectedImage.imageUrl}
                data-pubkey={selectedImage.pubkey}
                alt={selectedImage.caption || "Gallery image"}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext fill='%239ca3af' font-size='16' text-anchor='middle' x='200' y='155'%3EImage unavailable%3C/text%3E%3C/svg%3E";
                }}
              />
              {selectedImage.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 rounded-b-lg flex items-center justify-between gap-2">
                  <p className="text-sm">{selectedImage.caption}</p>
                  <div onClick={(e) => e.stopPropagation()}>
                    <EventActions
                      event={
                        selectedImage as unknown as Record<string, unknown>
                      }
                      onDelete={
                        user && user.pubkey === selectedImage.pubkey
                          ? () => handleDeleteImage(selectedImage)
                          : undefined
                      }
                      className="text-white hover:text-gray-300"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50"
            onClick={() => setShowUploadModal(false)}
            data-testid="upload-modal"
          >
            <div
              className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Add Photo to Gallery
                </h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {uploadError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}

              {!user && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 mb-2">
                    You need to login with Nostr to add photos.
                  </p>
                  {hasExtension ? (
                    <button
                      onClick={async () => {
                        try {
                          await loginWithExtension();
                        } catch (e) {
                          setUploadError(
                            e instanceof Error ? e.message : "Failed to login",
                          );
                        }
                      }}
                      className="px-4 py-2 bg-bitcoin-orange text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold text-sm"
                    >
                      Login with Nostr Extension
                    </button>
                  ) : (
                    <p className="text-sm text-yellow-700">
                      Install a Nostr extension like Alby or Nos2x to upload
                      images.
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleUploadSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    data-testid="upload-file-input"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setUploadForm({ ...uploadForm, file: f });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={!user || uploading}
                    required
                  />
                  {uploadForm.file && (
                    <p className="mt-1 text-sm text-gray-500">
                      {uploadForm.file.name} (
                      {(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Caption
                  </label>
                  <textarea
                    value={uploadForm.caption}
                    data-testid="upload-caption"
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, caption: e.target.value })
                    }
                    placeholder="Describe this photo..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={!user || uploading}
                    required
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    data-testid="upload-cancel"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="upload-submit"
                    className="px-4 py-2 bg-bitcoin-orange text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                    disabled={!user || uploading || !uploadForm.file}
                  >
                    {uploading ? "Uploading..." : "Upload Photo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
