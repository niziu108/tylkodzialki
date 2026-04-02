import { prisma } from "@/lib/prisma";

function pad(num: number, size = 4) {
  return String(num).padStart(size, "0");
}

export async function generateInvoiceNumber(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 1, 0, 0, 0, 0);

  const count = await prisma.invoice.count({
    where: {
      createdAt: {
        gte: startOfMonth,
        lt: endOfMonth,
      },
    },
  });

  const next = count + 1;

  return `FV/${year}/${String(month).padStart(2, "0")}/${pad(next)}`;
}