import React, { useState, useEffect } from "react";
import Head from "next/head";
import { config } from "@/config";
import { fetchNostrGalleryImages, GalleryImage, publishGalleryImage, uploadToBlossom } from "@/utils/galleryEvents";
import { useNostr } from "@/contexts/NostrContext";

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    caption: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { user, hasExtension, loginWithExtension } = useNostr();

  useEffect(() => {
    async function loadGalleryImages() {
      try {
        setLoading(true);
        setError(null);

        const galleryImages = await fetchNostrGalleryImages();
        setImages(galleryImages);
      } catch (err) {
        console.error("Failed to load gallery images:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load gallery images",
        );
      } finally {
        setLoading(false);
      }
    }

    loadGalleryImages();
  }, []);

  return (
    <>
      <Head>
        <title>Gallery - {config.site.title}</title>
        <meta name="description" content="Photos from our community events and meetups" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-12" data-testid="gallery-page">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-bitcoin-orange mb-4 font-archivo-black">
            Gallery
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Photos from our events, meetups, and community activities.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mb-8 text-center" data-testid="gallery-loading">
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

        {/* Error State */}
        {error && !loading && (
          <div className="mb-8 text-center" data-testid="gallery-error">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-xl font-semibold text-red-900 mb-2">
                Failed to Load Gallery
              </h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-bitcoin-orange text-white rounded-lg hover:bg-bitcoin-orange-hover transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Gallery Images Grid */}
        {!loading && !error && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold font-archivo-black text-gray-900">
                Event Photos
              </h2>
              <button
                data-testid="add-photo-btn"
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-bitcoin-orange text-white rounded-lg hover:bg-bitcoin-orange-hover transition-colors font-semibold"
              >
                Add Photo
              </button>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {images.map((image) => (
                  <div
                    key={image.id}
                    data-testid={`gallery-image-${image.id.slice(0, 8)}`}
                    className="cursor-pointer"
                    onClick={() => setSelectedImage(image)}
                  >
                    <img
                      src={image.imageUrl || image.thumbnailUrl}
                      alt={image.alt || image.caption || "Gallery image"}
                      className="w-full h-64 object-cover rounded-lg bg-gray-100"
                      loading="lazy"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                        const placeholder = el.nextElementSibling as HTMLElement;
                        if (placeholder) placeholder.style.display = "flex";
                      }}
                    />
                    <div
                      className="w-full h-64 bg-gray-100 rounded-lg items-center justify-center text-gray-400 hidden"
                    >
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    </div>
                    {image.caption && (
                      <p className="mt-2 text-sm text-gray-700">
                        {image.caption}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 text-center">
                      {new Date(image.created_at * 1000).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center" data-testid="gallery-empty">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Images Yet
                </h3>
                <p className="text-gray-600 mb-4">
                  There are no images in the gallery yet. Check back soon for photos from our events!
                </p>
              </div>
            )}
          </div>
        )}

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
                alt={selectedImage.alt || selectedImage.caption || "Gallery image"}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext fill='%239ca3af' font-size='16' text-anchor='middle' x='200' y='155'%3EImage unavailable%3C/text%3E%3C/svg%3E";
                }}
              />
              {selectedImage.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 rounded-b-lg">
                  <p className="text-sm">{selectedImage.caption}</p>
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
                <h3 className="text-xl font-bold text-gray-900">Add Photo to Gallery</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
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
                    You need to login with Nostr to add photos to the gallery.
                  </p>
                  {hasExtension ? (
                    <button
                      onClick={async () => {
                        try {
                          await loginWithExtension();
                        } catch (error) {
                          setUploadError(error instanceof Error ? error.message : "Failed to login");
                        }
                      }}
                      className="px-4 py-2 bg-bitcoin-orange text-white rounded-lg hover:bg-bitcoin-orange-hover transition-colors font-semibold text-sm"
                    >
                      Login with Nostr Extension
                    </button>
                  ) : (
                    <p className="text-sm text-yellow-700">
                      Please install a Nostr extension like Alby, Snort, or Nos2x to upload images.
                    </p>
                  )}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setUploadError(null);
                  setUploading(true);
                  setUploadProgress(0);

                  try {
                    if (!uploadForm.file || !uploadForm.caption) {
                      throw new Error("Please fill in all fields");
                    }

                    setUploadProgress(10);
                    const imageUrl = await uploadToBlossom(uploadForm.file, (progress) => {
                      setUploadProgress(Math.round(10 + (progress * 0.4)));
                    });

                    setUploadProgress(60);
                    const result = await publishGalleryImage(
                      imageUrl,
                      uploadForm.caption,
                      user?.pubkey,
                    );

                    setUploadProgress(90);
                    if (result.success) {
                      const updatedImages = await fetchNostrGalleryImages();
                      setImages(updatedImages);
                      setUploadProgress(100);
                      setShowUploadModal(false);
                      setUploadForm({ file: null, caption: "" });
                    } else {
                      throw new Error(result.error || "Failed to upload image");
                    }
                  } catch (error) {
                    setUploadError(error instanceof Error ? error.message : "Failed to upload image");
                  } finally {
                    setUploading(false);
                    setUploadProgress(0);
                  }
                }}
              >
                <div className="mb-4">
                  <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700 mb-1">
                    Image
                  </label>
                  <input
                    type="file"
                    id="imageFile"
                    data-testid="upload-file-input"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadForm({ ...uploadForm, file });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                    disabled={!user || uploading}
                    required
                  />
                  {uploadForm.file && (
                    <div className="mt-2 text-sm text-gray-600">
                      Selected: {uploadForm.file.name} ({(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  )}
                </div>

                {uploading && uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-bitcoin-orange h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-1">
                    Caption
                  </label>
                  <textarea
                    id="caption"
                    data-testid="upload-caption"
                    value={uploadForm.caption}
                    onChange={(e) => setUploadForm({ ...uploadForm, caption: e.target.value })}
                    placeholder="Describe this photo..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                    disabled={!user || uploading}
                    required
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    data-testid="upload-cancel"
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="upload-submit"
                    className="px-4 py-2 bg-bitcoin-orange text-white rounded-lg hover:bg-bitcoin-orange-hover transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!user || uploading || !uploadForm.file}
                  >
                    {uploading ? `Uploading... ${uploadProgress}%` : "Upload Photo"}
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
