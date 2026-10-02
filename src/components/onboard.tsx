import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { preload, useModel } from "@/lib/llm";

export function Onboard({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  const { model, status, progress, error } = useModel();

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Locus</CardTitle>
          <CardDescription>
            Private chat with {model.name}, running in your browser. The {model.size} model downloads once
            and stays cached.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field>
            <FieldLabel htmlFor="name">Your name</FieldLabel>
            <Input id="name" autoFocus value={name} placeholder="Ada" onChange={(event) => setName(event.target.value)} />
            <FieldDescription>Used in the greeting and shared with the model.</FieldDescription>
          </Field>
          {status !== "idle" && (
            <Field>
              <FieldLabel>{status === "ready" ? "Model ready" : `Downloading ${model.name}`}</FieldLabel>
              <Progress value={Math.round(progress * 100)} />
            </Field>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          {status === "ready" ? (
            <Button className="w-full" disabled={!name.trim()} onClick={() => onDone(name.trim())}>
              Open chat
            </Button>
          ) : (
            <Button className="w-full" disabled={status === "loading"} onClick={() => void preload()}>
              {status === "loading" && <Spinner />}
              {status === "error" ? "Retry" : status === "loading" ? "Downloading…" : "Download model"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
