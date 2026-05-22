import { useQuery } from "@tanstack/react-query";
import { Maximize2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/shared/page-header";
import { StatusBadge } from "../components/shared/status-badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/mock-api";

export function TranscriptsPage() {
  const { data = [] } = useQuery({ queryKey: ["transcripts"], queryFn: api.getTranscripts });
  const [search, setSearch] = useState("");
  const [fullscreenChat, setFullscreenChat] = useState<any | null>(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter((chat: any) =>
      [chat.visitor, chat.topic, chat.lastMessage, chat.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [data, search]);

  return (
    <div>
      <PageHeader
        title="Chat transcripts"
        description="Review website chatbot conversations, lead quality, unresolved questions, and escalation status for this clinic."
      />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search visitor, topic, or message" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <section className="grid gap-4 xl:grid-cols-2">
        {filtered.map((chat: any) => (
          <TranscriptCard key={chat.id} chat={chat} onFullscreen={() => setFullscreenChat(chat)} />
        ))}
      </section>

      {fullscreenChat && (
        <div className="fixed inset-0 z-50 bg-background/80 p-6 backdrop-blur">
          <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="font-semibold">{fullscreenChat.visitor}</p>
                <p className="text-xs text-muted-foreground">{fullscreenChat.messages.length} messages</p>
              </div>
              <Button size="icon" variant="outline" onClick={() => setFullscreenChat(null)} aria-label="Close fullscreen chat">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <TranscriptMessages chat={fullscreenChat} className="flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}

function TranscriptCard({ chat, onFullscreen }: { chat: any; onFullscreen: () => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="font-semibold">{chat.visitor}</p>
            <p className="text-xs text-muted-foreground">{chat.topic}</p>
            <p className="mt-1 text-xs text-muted-foreground">{chat.messages.length} messages</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={chat.status} />
            <span className="text-xs text-muted-foreground">{chat.time}</span>
            <Button size="icon" variant="outline" onClick={onFullscreen} aria-label="Open fullscreen chat">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <TranscriptMessages chat={chat} className="h-[360px]" />
      </CardContent>
    </Card>
  );
}

function TranscriptMessages({ chat, className }: { chat: any; className: string }) {
  return (
    <div className={`${className} space-y-3 overflow-y-auto bg-muted/30 p-4`}>
      {chat.messages.length ? (
        chat.messages.map((message: any) => (
          <div key={message.id} className={message.sender === "patient" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                message.sender === "patient"
                  ? "max-w-[78%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[78%] rounded-lg border bg-card px-3 py-2 text-sm"
              }
            >
              <p className="leading-6">{message.text}</p>
              <p className={message.sender === "patient" ? "mt-1 text-right text-[11px] text-primary-foreground/80" : "mt-1 text-[11px] text-muted-foreground"}>
                {message.sender === "patient" ? "Patient" : message.sender === "assistant" ? "AI assistant" : "Staff"} - {message.time}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground">{chat.lastMessage}</p>
      )}
    </div>
  );
}
