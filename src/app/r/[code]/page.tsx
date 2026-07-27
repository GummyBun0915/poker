import { notFound } from "next/navigation";
import { TableRoom } from "@/components/TableRoom";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(code)) notFound();
  return <TableRoom code={code} />;
}
