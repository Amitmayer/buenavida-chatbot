import { TareasBoard } from "@/components/tasks/tareas-board";

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{
    team?: string;
    area?: string;
    assignee?: string;
    status?: string;
    due?: string;
    todo?: string;
    q?: string;
    historial?: string;
  }>;
}) {
  return <TareasBoard searchParams={searchParams} />;
}
