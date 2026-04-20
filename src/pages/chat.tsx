import React from "react";
import Layout from "@/components/Layout";

const CORNYCHAT_URL = "https://cornychat.com";

export default function ChatPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-2">
          KC Bitcoiners Chat
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Join the conversation on CornyChat — a Nostr-based audio space
        </p>
        <div className="max-w-4xl mx-auto">
          <iframe
            src={CORNYCHAT_URL}
            className="w-full rounded-lg border border-gray-200"
            style={{
              height: "calc(100vh - 250px)",
              minHeight: "500px",
            }}
            allow="microphone; camera; autoplay"
            title="CornyChat"
          />
        </div>
      </div>
    </Layout>
  );
}
