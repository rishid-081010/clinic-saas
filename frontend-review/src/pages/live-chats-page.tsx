import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { Bot, Headphones, Send } from "lucide-react";
import { PageHeader } from "../components/shared/page-header";
import { StatusBadge } from "../components/shared/status-badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { api } from "../lib/mock-api";

export function LiveChatsPage() {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["live-chats"],
    queryFn: api.getLiveChats,
    refetchInterval: 2500,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedChat = useMemo(() => data.find((chat: any) => chat.id === selectedId) ?? data[0], [data, selectedId]);
  const takeOver = useMutation({
    mutationFn: api.takeOverChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-chats"] }),
  });
  const handOver = useMutation({
    mutationFn: api.handOverChatToAi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-chats"] }),
  });
  const sendStaff = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => api.sendStaffMessage(id, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-chats"] }),
  });

  function handleStaffMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChat?.aiPaused) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message")).trim();
    if (!message) return;
    sendStaff.mutate({ id: selectedChat.id, message }, { onSuccess: () => form.reset() });
  }

  return (
    <div>
      <PageHeader
        title="Live chats"
        description="Spectate patient chats, take over manually, then hand them back to AI with full context."
      />

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="space-y-2 p-3">
            {data.map((chat: any) => (
              <button
                key={chat.id}
                type="button"
                className={selectedChat?.id === chat.id ? "w-full rounded-md border border-primary bg-primary/10 p-3 text-left" : "w-full rounded-md border p-3 text-left hover:bg-muted"}
                onClick={() => setSelectedId(chat.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{chat.visitor}</p>
                  {chat.aiPaused ? <span className="rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">Staff</span> : <span className="rounded-full bg-muted px-2 py-1 text-xs">AI</span>}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{chat.lastMessage}</p>
                <p className="mt-1 text-xs text-muted-foreground">{chat.messages.length} messages</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {selectedChat ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <p className="font-semibold">{selectedChat.visitor}</p>
                    <p className="text-xs text-muted-foreground">{selectedChat.aiPaused ? "Staff takeover active" : "AI is replying"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedChat.status} />
                    {selectedChat.aiPaused ? (
                      <Button size="sm" variant="outline" onClick={() => handOver.mutate(selectedChat.id)}>
                        <Bot className="h-4 w-4" />
                        Hand over to AI
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => takeOver.mutate(selectedChat.id)}>
                        <Headphones className="h-4 w-4" />
                        Take over
                      </Button>
                    )}
                  </div>
                </div>

                <div className="h-[520px] space-y-3 overflow-y-auto bg-muted/30 p-4">
                  {selectedChat.messages.map((message: any) => (
                    <div key={message.id} className={message.sender === "patient" ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={
                          message.sender === "patient"
                            ? "max-w-[75%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                            : message.sender === "staff"
                              ? "max-w-[75%] rounded-lg border border-primary/30 bg-card px-3 py-2 text-sm"
                              : "max-w-[75%] rounded-lg border bg-card px-3 py-2 text-sm"
                        }
                      >
                        <p className="leading-6">{message.text}</p>
                        <p className={message.sender === "patient" ? "mt-1 text-right text-[11px] text-primary-foreground/80" : "mt-1 text-[11px] text-muted-foreground"}>
                          {message.sender === "patient" ? "Patient" : message.sender === "staff" ? "Staff" : "AI"} - {message.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <form className="flex gap-2 border-t p-3" onSubmit={handleStaffMessage}>
                  <input
                    name="message"
                    className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={selectedChat.aiPaused ? "Type staff reply" : "Take over to reply manually"}
                    disabled={!selectedChat.aiPaused || sendStaff.isPending}
                  />
                  <Button size="icon" disabled={!selectedChat.aiPaused || sendStaff.isPending} aria-label="Send staff message">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            ) : (
              <p className="p-5 text-sm text-muted-foreground">No live chats yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
