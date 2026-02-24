export async function GET() {
  const url = process.env.DATABASE_URL ?? null;

  return Response.json({
    hasDbUrl: !!url,
    length: url?.length ?? 0,
    startsWith: url ? url.slice(0, 12) : null, // pokaże "postgresql://"
  });
}