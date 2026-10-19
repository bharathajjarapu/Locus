import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { preload, useModel } from "@/lib/llm";

// Downloads the first model and welcomes the user.
export function Onboard({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  const { model, status, progress, error } = useModel();

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10 sm:p-8">
      <Card className="w-full max-w-md gap-8 border-0 bg-transparent py-0 shadow-none [--card-spacing:0px]">
        <CardHeader className="gap-4">
          <CardTitle className="text-3xl font-semibold tracking-[-0.03em]"><h1>Welcome to Locus</h1></CardTitle>
          <CardDescription className="text-base leading-7">
            Chat privately with {model.name} in your browser. Download the {model.size} model once to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field>
            <FieldLabel htmlFor="name">Your name</FieldLabel>
            <Input id="name" autoFocus autoComplete="given-name" className="h-11" value={name} placeholder="Ada" onChange={(event) => setName(event.target.value)} />
            <FieldDescription>Used in your greeting and by the local model.</FieldDescription>
          </Field>
          {status !== "idle" && (
            <Field>
              <div role="status" className="flex items-center justify-between gap-3 text-sm">
                <FieldLabel>{status === "ready" ? "Ready to chat" : status === "error" ? "Download interrupted" : `Downloading ${model.name}`}</FieldLabel>
                {status === "loading" && <span className="text-muted-foreground tabular-nums">{Math.round(progress * 100)}%</span>}
              </div>
              <Progress value={Math.round(progress * 100)} />
            </Field>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="border-0 bg-transparent p-0">
          {status === "ready" ? (
            <Button className="h-11 w-full" disabled={!name.trim()} onClick={() => onDone(name.trim())}>
              Open chat
            </Button>
          ) : (
            <Button className="h-11 w-full" disabled={status === "loading"} onClick={() => void preload()}>
              {status === "loading" && <Spinner />}
              {status === "error" ? "Retry download" : status === "loading" ? "Downloading…" : "Download model"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
