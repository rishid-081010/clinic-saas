import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent } from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "../components/shared/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/mock-api";

export function FaqPage() {
  const { data = [] } = useQuery({ queryKey: ["faqs"], queryFn: api.getFaqs });
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const createFaq = useMutation({
    mutationFn: api.createFaq,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["faqs"] }),
  });
  const updateFaq = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { question: string; answer: string; active: boolean } }) => api.updateFaq(id, input),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
    },
  });

  function handleCreateFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    createFaq.mutate({
      question: String(formData.get("question")),
      answer: String(formData.get("answer")),
    }, {
      onSuccess: () => form.reset(),
    });
  }

  function handleUpdateFaq(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateFaq.mutate({
      id,
      input: {
        question: String(formData.get("question")),
        answer: String(formData.get("answer")),
        active: formData.get("active") === "on",
      },
    });
  }

  return (
    <div>
      <PageHeader
        title="FAQ content"
        description="Manage approved question-and-answer content for the patient chatbot."
      />

      <section className="space-y-4">
        <Card>
          <CardContent className="p-5">
            <form className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]" onSubmit={handleCreateFaq}>
              <Input name="question" placeholder="Question" required />
              <Input name="answer" placeholder="Answer" required />
              <Button disabled={createFaq.isPending}>
                <Plus className="h-4 w-4" />
                Add FAQ
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {data.map((faq: any) => (
            <Card key={faq.id}>
              <CardContent className="p-5">
                {editingId === faq.id ? (
                  <form className="grid gap-3" onSubmit={(event) => handleUpdateFaq(event, faq.id)}>
                    <Input name="question" defaultValue={faq.question} required />
                    <Input name="answer" defaultValue={faq.answer} required />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input name="active" type="checkbox" defaultChecked={faq.active} />
                      Active
                    </label>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={updateFaq.isPending}>Save</Button>
                      <Button size="sm" variant="outline" type="button" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold">{faq.question}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditingId(faq.id)}>Edit</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
