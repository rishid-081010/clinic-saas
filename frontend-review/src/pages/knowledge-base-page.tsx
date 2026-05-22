import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import { FormEvent, useState } from "react";
import { PageHeader } from "../components/shared/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/mock-api";

type KnowledgeFile = {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  status: string;
  chunkCount: number;
};

export function KnowledgeBasePage() {
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const { data = [] } = useQuery<KnowledgeFile[]>({
    queryKey: ["knowledge-files"],
    queryFn: api.getKnowledgeFiles,
  });
  const upload = useMutation({
    mutationFn: api.uploadKnowledgeFile,
    onSuccess: () => {
      setFile(null);
      void queryClient.invalidateQueries({ queryKey: ["knowledge-files"] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file) upload.mutate(file);
  }

  return (
    <div>
      <PageHeader
        title="Knowledge base"
        description="Upload clinic documents. The backend extracts text, vectors it with Vertex Gemini embeddings, and the chatbot retrieves from it."
      />

      <Card>
        <CardHeader>
          <CardTitle>Upload chatbot knowledge</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 md:flex-row md:items-center" onSubmit={handleSubmit}>
            <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-between rounded-md border bg-background px-4 text-sm hover:bg-muted">
              <span className={file ? "font-medium" : "text-muted-foreground"}>
                {file ? file.name : "Choose a PDF, text, CSV, or Markdown file"}
              </span>
              <span className="rounded-md border bg-card px-3 py-1 text-xs font-medium">Browse</span>
              <Input
                accept=".pdf,.txt,.csv,.md"
                className="sr-only"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <Button disabled={!file || upload.isPending}>
              <UploadCloud className="h-4 w-4" />
              {upload.isPending ? "Vectoring..." : "Upload"}
            </Button>
          </form>
          {upload.isSuccess && (
            <p className="mt-3 rounded-md bg-accent p-3 text-sm font-medium">
              File uploaded, chunked, embedded, and stored for chatbot retrieval.
            </p>
          )}
          {upload.isError && (
            <p className="mt-3 rounded-md bg-destructive p-3 text-sm font-medium text-destructive-foreground">
              Upload failed. Check that the backend and Vertex AI credentials are configured.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Uploaded files</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Chunks</th>
                <th className="px-5 py-3">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 font-medium">{item.fileName}</td>
                  <td className="px-5 py-4 text-muted-foreground">{item.fileType}</td>
                  <td className="px-5 py-4">{item.status}</td>
                  <td className="px-5 py-4">{item.chunkCount}</td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {new Date(item.uploadedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!data.length && (
                <tr>
                  <td className="px-5 py-8 text-muted-foreground" colSpan={5}>
                    No files uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
