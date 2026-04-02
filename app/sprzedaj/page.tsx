import DzialkaForm from "@/components/DzialkaForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { redirect } from "next/navigation";

export default async function SprzedajPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/auth");
  }

  return <DzialkaForm mode="create" />;
}